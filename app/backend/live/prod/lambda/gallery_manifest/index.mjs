import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const kms = new KMSClient({});
const s3 = new S3Client({});

const bucketName = process.env.GALLERY_BUCKET;
const defaultPrefix = normalizePrefix(process.env.GALLERY_DEFAULT_PREFIX || "months");
const testPrefix = normalizePrefix(process.env.GALLERY_TEST_PREFIX || "test");
const publicBaseUrl = (process.env.GALLERY_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const signerKeyPairId = process.env.GALLERY_SIGNER_KEY_PAIR_ID || "";
const signerKmsKeyId = process.env.GALLERY_SIGNER_KMS_KEY_ID || "";
const signedUrlTtlSeconds = Number.parseInt(process.env.GALLERY_SIGNED_URL_TTL || "900", 10);
const imageExtensionPattern = /\.(avif|gif|jpe?g|png|webp)$/i;

function normalizePrefix(prefix) {
  return String(prefix || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}

function normalizeClaimValues(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\s,;|]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value).trim().toLowerCase()];
  }

  return [];
}

function isTestAccount(claims) {
  const target = "test";
  const groups = normalizeClaimValues(claims?.["cognito:groups"]);

  if (groups.includes(target)) {
    return true;
  }

  const tagKeys = ["custom:tag", "custom:tags", "tag", "tags"];
  const tags = tagKeys.flatMap((key) => normalizeClaimValues(claims?.[key]));

  if (tags.includes(target)) {
    return true;
  }

  return ["custom:test", "test"].some((key) => {
    const values = normalizeClaimValues(claims?.[key]);
    return values.includes("true") || values.includes(target);
  });
}

function toCloudFrontSafeBase64(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/=/g, "_")
    .replace(/\//g, "~");
}

function encodePathSegments(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildCannedPolicy(resourceUrl, expiresAtEpochSeconds) {
  return JSON.stringify({
    Statement: [
      {
        Resource: resourceUrl,
        Condition: {
          DateLessThan: {
            "AWS:EpochTime": expiresAtEpochSeconds,
          },
        },
      },
    ],
  });
}

async function signPolicy(policy) {
  const response = await kms.send(
    new SignCommand({
      KeyId: signerKmsKeyId,
      Message: Buffer.from(policy, "utf8"),
      MessageType: "RAW",
      SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
    })
  );

  if (!response.Signature) {
    throw new Error("KMS did not return a CloudFront signature.");
  }

  return toCloudFrontSafeBase64(response.Signature);
}

async function listGalleryKeys(prefix) {
  const keys = [];
  let continuationToken;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `${prefix}/`,
        ContinuationToken: continuationToken,
      })
    );

    for (const item of response.Contents || []) {
      if (item.Key && !item.Key.endsWith("/") && imageExtensionPattern.test(item.Key)) {
        keys.push(item.Key);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys.sort((left, right) => compareGalleryKeys(left, right));
}

function compareGalleryKeys(left, right) {
  const leftName = left.split("/").pop() || left;
  const rightName = right.split("/").pop() || right;
  const leftNumber = Number.parseInt(leftName, 10);
  const rightNumber = Number.parseInt(rightName, 10);
  const leftIsNumber = Number.isFinite(leftNumber);
  const rightIsNumber = Number.isFinite(rightNumber);

  if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return leftName.localeCompare(rightName, undefined, { numeric: true, sensitivity: "base" });
}

function buildLabel(key) {
  const filename = key.split("/").pop() || key;
  return filename.replace(/\.[^.]+$/, "");
}

async function buildSignedPhoto(key, expiresAtEpochSeconds) {
  const resourceUrl = `${publicBaseUrl}/${encodePathSegments(key)}`;
  const policy = buildCannedPolicy(resourceUrl, expiresAtEpochSeconds);
  const signature = await signPolicy(policy);
  const signedUrl = new URL(resourceUrl);

  signedUrl.searchParams.set("Expires", String(expiresAtEpochSeconds));
  signedUrl.searchParams.set("Signature", signature);
  signedUrl.searchParams.set("Key-Pair-Id", signerKeyPairId);
  signedUrl.searchParams.set("Hash-Algorithm", "SHA256");

  return {
    key,
    label: buildLabel(key),
    url: signedUrl.toString(),
  };
}

export const handler = async (event) => {
  try {
    if (!bucketName || !publicBaseUrl || !signerKeyPairId || !signerKmsKeyId) {
      return json(500, {
        error: "Gallery manifest backend is missing required configuration.",
      });
    }

    const claims = event?.requestContext?.authorizer?.jwt?.claims || {};

    if (claims.token_use !== "id") {
      return json(403, {
        error: "Gallery manifest requests must use a Cognito ID token.",
      });
    }

    const isTest = isTestAccount(claims);
    const prefix = isTest ? testPrefix : defaultPrefix;
    const keys = await listGalleryKeys(prefix);
    const expiresAtEpochSeconds =
      Math.floor(Date.now() / 1000) + Math.max(signedUrlTtlSeconds, 60);
    const photos = [];

    for (const key of keys) {
      photos.push(await buildSignedPhoto(key, expiresAtEpochSeconds));
    }

    return json(200, {
      collection: isTest ? "test" : "default",
      prefix,
      expiresAt: expiresAtEpochSeconds,
      user: {
        email: claims.email || null,
      },
      photos,
    });
  } catch (error) {
    console.error("Unable to build gallery manifest.", error);
    return json(500, {
      error: "Unable to load the private gallery right now.",
    });
  }
};

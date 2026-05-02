# Backend Infrastructure

Terraform lives here for the private photo backend that sits behind the Everyday Lilly website and app.

## Current Goal

The backend is split into two storage lanes:

- `archive` storage for the full long-term library.
  This is for the complete photo collection and is designed to transition objects into S3 Glacier Deep Archive for low-cost, long-term retention.
- `gallery` storage for a much smaller set of monthly images.
  This stays in a normal S3 bucket behind CloudFront so the website/app can load selected photos quickly after login.

The root website now has a real Cognito-backed sign-in flow.
This backend stack now owns the secure gallery access path:

- Amazon Cognito user pool for authentication
- private gallery bucket
- CloudFront distribution in front of the gallery bucket
- JWT-protected gallery manifest API
- CloudFront signed URLs minted on demand in stable cache windows

## Folder Layout

```text
app/backend/
├── README.md
└── live/
    └── prod/
        ├── gallery_api.tf
        ├── lambda/
        │   └── gallery_manifest/
        │       └── index.mjs
        ├── locals.tf
        ├── main.tf
        ├── outputs.tf
        ├── providers.tf
        ├── terraform.tfvars.example
        ├── variables.tf
        └── versions.tf
```

## State Strategy

This repo no longer depends on a Terraform-managed remote state bucket.
`live/prod/` is set up for local/manual state handling, which matches your current workflow of keeping the state file elsewhere.

If you already created the old `everydaylilly` Terraform state bucket during bootstrap, that bucket is now outside the active repo workflow.
You can delete it manually later once you have confirmed nothing still points Terraform at that bucket.

Important:

- Do not commit raw `terraform.tfstate` files into Git.
- Do not store raw Terraform state as a normal GitHub backup.
  State can contain sensitive and operationally important values.
- If you want an extra GitHub-side backup, use an encrypted artifact or encrypted export of `terraform state pull`, not a committed plaintext state file.
- If you keep state outside the repo, make sure it is backed up and access-controlled because it is now your source of truth.

## Suggested Object Layout

### Archive bucket

Recommended structure:

```text
originals/
  2024/
    01/
      IMG_0001.heic
      IMG_0002.jpg
```

This keeps the big library easy to sync and browse later.
Objects should transition to S3 Deep Archive after 7 days.

### Gallery bucket

Recommended structure:

```text
months/
  0.jpg
  1.jpg
  2.jpg
  11.jpg
  ...
```

This follows your flat numeric naming convention rather than `01.jpg` through `12.jpg`.
For example:

- `1.jpg` can be the first picture in the first month
- `2.jpg` can be the first picture in the second month
- `11.jpg` can be another picture for the first month

Because this is a custom convention, the gallery now treats these keys with your grouping rules instead of assuming calendar month filenames.

## Apply Flow

```bash
cd app/backend/live/prod
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

Important for this stack:

- set `gallery_public_base_url` in `terraform.tfvars` to the viewer-facing CloudFront base URL for the gallery, for example `https://d1fxhro74spn7q.cloudfront.net`
- keep `gallery_month_prefix = "months"` and `gallery_test_prefix = "test"` aligned with your upload layout

If this folder was previously initialized against the old S3 backend, do a one-time reinitialization before the next apply:

- use `terraform init -migrate-state` if you want Terraform to pull the existing backend state down into local state
- use `terraform init -reconfigure` if you already have the local state file you want to use and just want Terraform to stop pointing at the old backend

## GitHub Secrets and Variables

Suggested split:

- GitHub Secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
- GitHub Variables or environment config:
  - AWS region
  - Cognito client id
  - Cognito hosted UI base URL
  - CloudFront domain
  - gallery bucket name

Endpoints are usually better stored as non-secret variables than as secrets unless you have a specific reason to hide them.

## Current Prod Outputs

Current environment values and reference keys:

- archive bucket: `everyday-lilly-vault-prod-archive-rnk3lm46`
- gallery bucket: `everyday-lilly-vault-prod-gallery-rnk3lm46`
- CloudFront domain: `d1fxhro74spn7q.cloudfront.net`
- gallery manifest URL: `https://d1fxhro74spn7q.cloudfront.net/api/gallery/manifest`
- gallery month prefix: `months`
- example gallery object key: `months/0.jpg`
- example same-series gallery object key: `months/11.jpg`
- Cognito user pool id: `eu-central-1_vaA1ovTyr`
- Cognito app client id: `680v9kq2oue5323c6r63egrltg`
- Cognito hosted UI base URL: `https://everyday-lilly-vault-prod-1234.auth.eu-central-1.amazoncognito.com`
- Cognito hosted UI login URL:
  `https://everyday-lilly-vault-prod-1234.auth.eu-central-1.amazoncognito.com/login?client_id=680v9kq2oue5323c6r63egrltg&response_type=code&scope=openid+email+profile+aws.cognito.signin.user.admin&redirect_uri=https%3A%2F%2Fwww.everydaylilly.com%2Fauth%2Fcallback.html`

Suggested GitHub variable set for later frontend/app wiring:

- `AWS_REGION=eu-central-1`
- `COGNITO_USER_POOL_ID=eu-central-1_vaA1ovTyr`
- `COGNITO_APP_CLIENT_ID=680v9kq2oue5323c6r63egrltg`
- `COGNITO_HOSTED_UI_BASE_URL=https://everyday-lilly-vault-prod-1234.auth.eu-central-1.amazoncognito.com`
- `GALLERY_CLOUDFRONT_DOMAIN=d1fxhro74spn7q.cloudfront.net`
- `GALLERY_MANIFEST_URL=https://d1fxhro74spn7q.cloudfront.net/api/gallery/manifest`
- `GALLERY_MONTH_PREFIX=months`

## Current Scope

This stack is now intended to enforce gallery access through the backend.
The browser gallery should no longer decide which collection is visible, and viewers should no longer load raw CloudFront object URLs directly.

For the real website login, the safest first implementation is to use Cognito hosted UI rather than handling password challenges entirely inside the current custom modal. Hosted UI already handles flows like:

- temporary-password first login
- forced password reset
- forgot password
- reset confirmation

The current Terraform keeps the password policy intentionally lighter for a family photo vault:

- minimum length `8`
- lowercase required
- number required
- uppercase optional
- symbols optional

If the site later moves to a fully custom login form, it must explicitly support the Cognito `NEW_PASSWORD_REQUIRED` challenge and the full forgot-password flow.
Until that is built end to end, the best-practice website behavior is:

- use the modal as a simple entry point
- send real sign-in, first-login password change, and forgot-password actions to Cognito hosted UI
- return to your site only after Cognito finishes those flows

The backend gallery routing rules are:

- standard accounts receive the `months/` collection
- accounts in the Cognito group `test` receive the `test/` collection
- accounts with a tag-like claim of `test` also receive the `test/` collection
  Supported claim keys are `custom:tag`, `custom:tags`, `tag`, `tags`, `custom:test`, and `test`

The enforcement model is:

1. the browser signs in with Cognito Hosted UI
2. the gallery page calls `GET /api/gallery/manifest` through CloudFront with a Cognito ID token
3. API Gateway validates the JWT
4. the Lambda manifest function decides the allowed prefix and lists the matching objects
5. the Lambda uses AWS KMS plus a trusted CloudFront key group to mint signed URLs inside a stable cache window
6. CloudFront serves photo objects only when the URL signature is valid

The current website routing model is:

- after Cognito login, browser-side claims send likely test accounts to `/gallery/test/` and everyone else to `/gallery/months/`
- the backend manifest remains authoritative and the frontend corrects the route if someone opens the wrong page manually
- `months/` is rendered as a month-by-month ordered gallery
- `test/` is rendered as a randomized collage on each page load

The current caching model is:

- CloudFront remains the image delivery layer
- signed URLs are generated in stable time buckets instead of changing on every manifest request
- the default TTL now targets a 7-day cache window for better browser reuse
- if you replace an image under the same key and need it to show immediately, use a CloudFront invalidation or temporarily clear browser cache

For the managed login website flow, keep the app client aligned with the browser code:

- include the reserved OAuth scope `aws.cognito.signin.user.admin`
- allow password-oriented app client flows that managed login can use, including `ALLOW_USER_AUTH`, `ALLOW_USER_PASSWORD_AUTH`, and `ALLOW_USER_SRP_AUTH`

If the website callback page shows `invalid_scope`, the frontend has started requesting a scope that the deployed Cognito app client has not been updated to allow yet. Re-run `terraform apply` for `live/prod` so the app client settings in AWS match the website code.

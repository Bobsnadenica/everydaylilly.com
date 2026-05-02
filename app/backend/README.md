# Backend Infrastructure

Terraform lives here for the private photo backend that sits behind the Everyday Lilly website and app.

## Current Goal

The backend is split into two storage lanes:

- `archive` storage for the full long-term library.
  This is for the complete photo collection and is designed to transition objects into S3 Glacier Deep Archive for low-cost, long-term retention.
- `gallery` storage for a much smaller set of monthly images.
  This stays in a normal S3 bucket behind CloudFront so the website/app can load selected photos quickly after login.

The root website currently has a login modal UI, but it is still a mockup.
This backend scaffolding prepares the real pieces for turning that into a real sign-in flow:

- Amazon Cognito user pool for authentication
- private gallery bucket
- CloudFront distribution in front of the gallery bucket

## Folder Layout

```text
app/backend/
├── README.md
├── bootstrap/
│   ├── main.tf
│   ├── outputs.tf
│   ├── terraform.tfvars.example
│   ├── variables.tf
│   └── versions.tf
└── live/
    └── prod/
        ├── backend.tf
        ├── locals.tf
        ├── main.tf
        ├── outputs.tf
        ├── providers.tf
        ├── terraform.tfvars.example
        ├── variables.tf
        └── versions.tf
```

## State Strategy

Use the `bootstrap/` stack first to create a dedicated S3 bucket for Terraform state.
Then point `live/prod/` at that bucket with the S3 backend and `use_lockfile = true`.

Important:

- Do not commit raw `terraform.tfstate` files into Git.
- Do not store raw Terraform state as a normal GitHub backup.
  State can contain sensitive and operationally important values.
- If you want an extra GitHub-side backup, use an encrypted artifact or encrypted export of `terraform state pull`, not a committed plaintext state file.

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

### Gallery bucket

Recommended structure:

```text
months/
  01.jpg
  02.jpg
  03.jpg
  ...
  12.jpg
```

If you strongly prefer `1.jpg` through `12.jpg`, that is still workable, but `01.jpg` through `12.jpg` is safer for sorting and future automation.

## Bootstrap Flow

1. Create the remote state bucket:

```bash
cd app/backend/bootstrap
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

2. Use the output bucket name to initialize the live stack:

```bash
cd ../live/prod
cp terraform.tfvars.example terraform.tfvars
terraform init \
  -backend-config="bucket=<state-bucket-name>" \
  -backend-config="key=live/prod/terraform.tfstate" \
  -backend-config="region=<aws-region>" \
  -backend-config="use_lockfile=true"
terraform apply
```

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

Current deployed values from the first `live/prod` apply:

- archive bucket: `everyday-lilly-vault-prod-archive-rnk3lm46`
- gallery bucket: `everyday-lilly-vault-prod-gallery-rnk3lm46`
- CloudFront domain: `d1fxhro74spn7q.cloudfront.net`
- gallery month prefix: `months`
- example gallery object key: `months/01.jpg`
- Cognito user pool id: `eu-central-1_MvkQRbixF`
- Cognito app client id: `4dkopqkvkuflitvfefp6566p33`
- Cognito hosted UI base URL: `https://everyday-lilly-vault-prod-1234.auth.eu-central-1.amazoncognito.com`
- Cognito hosted UI login URL:
  `https://everyday-lilly-vault-prod-1234.auth.eu-central-1.amazoncognito.com/login?client_id=4dkopqkvkuflitvfefp6566p33&response_type=code&scope=openid+email+profile&redirect_uri=https%3A%2F%2Fwww.everydaylilly.com%2Fauth%2Fcallback.html`

Suggested GitHub variable set for later frontend/app wiring:

- `AWS_REGION=eu-central-1`
- `COGNITO_USER_POOL_ID=eu-central-1_MvkQRbixF`
- `COGNITO_APP_CLIENT_ID=4dkopqkvkuflitvfefp6566p33`
- `COGNITO_HOSTED_UI_BASE_URL=https://everyday-lilly-vault-prod-1234.auth.eu-central-1.amazoncognito.com`
- `GALLERY_CLOUDFRONT_DOMAIN=d1fxhro74spn7q.cloudfront.net`
- `GALLERY_MONTH_PREFIX=months`

## Current Scope

This first Terraform cut provisions the durable storage and auth foundation.
It does not yet wire the website login modal into Cognito, nor does it yet mint signed image URLs/cookies for the private gallery.

That next step should likely be:

1. wire the login UI to Cognito hosted UI or Cognito JS auth
2. add a gallery endpoint or signed-content flow
3. render the monthly gallery from `months/01.jpg` to `months/12.jpg`

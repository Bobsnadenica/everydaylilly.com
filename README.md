# everydaylilly.com

Repository for the Everyday Lilly public website, companion microsites, Flutter app, and the first Terraform scaffold for the private photo backend.

## What Lives Here

This repo now has three main concerns:

1. Static public website pages for the Everyday app family.
2. The Flutter app source for Everyday Lilly.
3. Terraform infrastructure under `app/backend/` for the future private photo backend.

## Website

The public site is still a static multi-page site intended for GitHub Pages style hosting.

- `index.html` and `index-bg.html` are the main landing pages.
- `script.js` powers shared interactions such as the screenshot lightbox, carousel behavior, language switching, and the current login modal UI.
- `style.css` contains the shared visual layer for the main site.
- `everyday_dandelion/`, `everyday_storage/`, and `everyday_stuff/` contain companion microsites and project pages.

Important:

- The root landing page now includes a login/profile modal UI.
- That UI is still a frontend mockup today.
- Real authentication is intended to come from the backend stack in `app/backend/`.

## Flutter App

The app source is in:

- `app/everyday_lilly/`

This contains the mobile/web/desktop Flutter project, its assets, and app-specific docs.

## Backend Infrastructure

Terraform for the private photo backend lives in:

- `app/backend/`

That backend is currently designed around two storage paths:

- `archive` storage for the full long-term photo collection.
- `gallery` storage for a smaller monthly selection that can sit behind CloudFront.

Auth is planned around Amazon Cognito so the current login mockup can become real later.

See `app/backend/README.md` for the backend-specific runbook.

## Repository Structure

```text
.
├── CNAME
├── README.md
├── index.html
├── index-bg.html
├── script.js
├── style.css
├── images/
├── everyday_dandelion/
├── everyday_storage/
├── everyday_stuff/
└── app/
    ├── backend/
    └── everyday_lilly/
```

## Local Development

### Static website preview

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Notes:

- No website build step is required.
- Some pages load Tailwind CSS and Google Fonts from CDNs, so a network connection helps for visual parity.

### Backend workflow

The Terraform flow is intentionally split:

1. `app/backend/bootstrap/` creates the remote S3 state bucket.
2. `app/backend/live/prod/` provisions the photo backend using that remote state bucket.

Do not commit `.tfstate` files to Git.

## Content and Maintenance Notes

- Keep English and Bulgarian copy aligned when editing mirrored pages.
- Update both `index.html` and `index-bg.html` when changing shared login modal behavior.
- Add new public site assets under `images/`.
- Keep `app/backend/README.md` in sync with backend architecture decisions so the repo itself carries the current plan.

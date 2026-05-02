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
- `script.js` powers shared interactions such as the screenshot lightbox, carousel behavior, language switching, and the Cognito-backed login modal flow.
- `auth/` contains the browser-side Cognito helper and callback page.
- `gallery/` contains the signed-in photo gallery routes. It now includes an auto-router plus separate `months/` and `test/` experiences backed by the same manifest API.
- `style.css` contains the shared visual layer for the main site.
- `everyday_dandelion/`, `everyday_storage/`, and `everyday_stuff/` contain companion microsites and project pages.

Important:

- The root landing page now includes a login/profile modal UI.
- The landing page now hands real sign-in over to Cognito Hosted UI and returns through `auth/callback.html`.
- After login, users now land in the private gallery route that matches their Cognito-backed account type.
- The backend, not the browser, decides whether that account can see the standard `months/` collection or the `test/` collection, and the frontend corrects the route if someone opens the wrong page directly.
- Gallery images are still served from CloudFront, but the signed URLs are now bucketed for longer-lived browser caching instead of changing on every single manifest refresh.
- If the callback page shows `invalid_scope`, the deployed Cognito app client needs a fresh Terraform apply so its allowed scopes match the website code.

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

Auth now runs through Amazon Cognito Hosted UI, and the backend stack is responsible for enforcing who can actually read gallery photos.

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

The Terraform stack now lives directly in:

- `app/backend/live/prod/`

This repo does not rely on a Terraform-managed remote state bucket anymore.
Do not commit `.tfstate` files to Git.
If you previously created the old `everydaylilly` bootstrap bucket, it is no longer part of the repo workflow and can be deleted manually after you verify nothing still uses it.

## Content and Maintenance Notes

- Keep English and Bulgarian copy aligned when editing mirrored pages.
- Update both `index.html` and `index-bg.html` when changing shared login modal behavior.
- Add new public site assets under `images/`.
- Keep `app/backend/README.md` in sync with backend architecture decisions so the repo itself carries the current plan.

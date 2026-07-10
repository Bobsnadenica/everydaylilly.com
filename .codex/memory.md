# Everyday Lilly Project Memory

Last updated: 2026-07-10 Europe/Sofia

## Repo Snapshot

- This repository contains the Everyday Lilly public website, companion static microsites, auth/gallery frontend code, and Terraform notes for the private photo backend.
- The public website is a static multi-page site. There is no package build step for the root site.
- Main root files: `index.html`, `index-bg.html`, `style.css`, `script.js`, `images/`, `auth/`, `gallery/`, and the companion folders `everyday_dandelion/`, `everyday_storage/`, `everyday_stuff/`.
- Backend infrastructure notes live in `app/backend/README.md`; Terraform lives under `app/backend/live/prod/`.

## Local Workflow

- Preview from the repo root with `python3 -m http.server 8000 --bind 127.0.0.1`.
- Prefer `http://localhost:8000/` for browser checks. On 2026-06-15, the in-app browser showed a stale `ThePrivilegedCompany` page at `http://127.0.0.1:8000/` even though `curl -I` confirmed the Python server was returning this repo's `index.html`.
- Some pages rely on CDN Tailwind and Google Fonts, so visual parity may need network access.

## Website QA Notes

- 2026-07-10 public landing improvement pass: replaced the overlapping 3D app carousel with one visible app card at a time, kept previous/next controls visible at desktop and mobile sizes, added a `1 / 4` status, confined arrow-key navigation to the focused carousel, and made inactive app links untabbable. Replaced 15 tiny non-focusable gallery dots with 44px previous/next buttons and a `1 / 15` status; gallery/lightbox initialization now safely skips pages without gallery markup, fixing the shared `supportus.html` script error. Added reduced-motion handling and normalized English `FAQ` capitalization. `node --check script.js`, `git diff --check`, and browser QA passed on English/Bulgarian pages at `1280x720` and `390x844`: one card visible, controls present, no horizontal overflow, longest Bulgarian Filetrap card contained, gallery counter advanced, support page had no console errors, and landing pages had no console errors.
- 2026-07-10 public landing-page design review at `http://localhost:8000/`: desktop `1280x720` and mobile `390x844` screenshots confirmed that the core visual identity, copy hierarchy, gallery section, support, and contact sections are clean and coherent. The highest-impact issue is the app carousel: on desktop its controls sit below the initial viewport and navigating exposes overlapping adjacent cards; on mobile the carousel grows wider than the viewport, clips the Android CTA, and hides the control container at `0x0`. The gallery uses 15 non-focusable `div` dots at roughly `12x12`, so keyboard access and target size need improvement. The page still logs the Tailwind CDN production warning. No public-site code was changed during this review.
- 2026-06-15 desktop smoke test at `http://localhost:8000/` passed: the intended title loaded, the DOM was not blank, there was no error overlay, no console errors appeared, and `#carousel-next` advanced the active card from `Everyday Lilly` to `Everyday Dandelion`.
- Known console warning: `cdn.tailwindcss.com should not be used in production`. This comes from the current static Tailwind CDN setup.
- 2026-06-15 mobile check at `390x844`: the page loaded with no horizontal document overflow, but `#carousel-prev` and `#carousel-next` had `0x0` bounding boxes and were not clickable. The carousel/card row can appear partially clipped on mobile. Treat this as a known responsive issue to fix if carousel interaction matters on phones.
- 2026-06-15 full-site audit checked all 26 HTML pages locally at `http://localhost:8000/`. Static link scan found no broken local `href`/`src` targets. Main improvement candidates: `supportus.html` throws a shared `script.js` null-reference error; `how_to.html` is a bare placeholder with no title/meta/H1; several privacy/gallery/support pages lack meta descriptions; mobile overflow appears on `auth/callback.html` and `everyday_stuff/Who_Wants_to_be_smart/dlc_website/index.html`; root carousel controls collapse to `0x0` on mobile.

## Auth And Gallery

- Root landing pages include Cognito Hosted UI configuration in `body` data attributes.
- `auth/auth.js` owns popup login, callback session handling, PKCE, and local/session storage keys.
- After login, users land in private gallery routes. The backend manifest remains authoritative for whether the user sees `months/` or `test/`.
- `gallery/app.js` renders pictures, GIFs, and movies from the signed manifest feed, with filter chips and different `months` vs `test` layouts.
- If the callback page shows `invalid_scope`, the Cognito app client likely needs Terraform reapplied so allowed scopes match the website code.
- 2026-06-15 gallery backend update: Cognito groups are now `admin` and `viewers`; `admin` can view and upload, `viewers` can view only, and `test` still routes to the test collection. Assign existing users to one of these groups after Terraform apply or the manifest Lambda will return 403.
- Gallery admin uploads now use `POST /api/gallery/upload-url`, then a short-lived duplicate-safe S3 PUT URL. Upload keys are `months/<0-59>/<filename>`, existing flat keys still display, and duplicate filenames in the same month return 409 before upload. S3 PUT URLs are signed with `If-None-Match: *` so overwrite races fail too.
- Gallery media remains CloudFront cached with long-lived immutable caching and signed URLs. The duplicate-safe upload model is what makes the immutable cache safe for newly uploaded media.
- Gallery manifests now include `lastModified`/`size`, and frontend month/test views sort by object date with filename fallback. The popup viewer explicitly contains images/videos and preserves `[hidden]` media so the unused video element cannot steal modal space.
- 2026-06-15 gallery validation: `node --check` passed for `gallery/app.js` and `app/backend/live/prod/lambda/gallery_manifest/index.mjs`; `terraform fmt -check app/backend/live/prod` and `terraform validate` passed. Browser QA used a temporary local mock at `http://127.0.0.1:8001/everyday-lilly-gallery-mock.html`; desktop and 390x844 mobile checks showed admin upload panel visible for `canUpload`, no console errors, sorted month detail, no horizontal overflow, and contained popup media.
- 2026-06-16 gallery upload UI revision: the top admin upload panel was removed. Admins now open a month and use an upload tile inside the month grid; empty months show a hero-image tile first, and months with a hero/photos show an `Upload pictures` drag/drop tile as the last grid card. Photo tile supports many files. Hero uploads target `months/hero/<month>/<filename>`; normal photos target `months/<month>/<filename>`.
- 2026-06-16 gallery validation: `node --check` passed for `gallery/app.js` and `app/backend/live/prod/lambda/gallery_manifest/index.mjs`; `terraform fmt -check app/backend/live/prod` and `terraform validate` passed. Browser QA used temporary mock `http://127.0.0.1:8001/everyday-lilly-gallery-upload-mock.html`: empty month 2 showed only one hero upload tile, generated hero drop switched to photo upload mode, generated two-photo drop produced two photo cards plus upload tile last, desktop/mobile had no console errors or horizontal overflow.
- 2026-06-16 correction: the public homepage hero polish from commit `28dca5b` was not wanted; root landing files were restored back before that hero change. Future "Хрониката на Лили background" work refers to the authenticated gallery after login, not the public homepage.
- 2026-06-16 authenticated gallery polish: `/gallery/months/` now has a private-vault hero, status/refresh toolbar, professional glass surfaces, improved month cards/detail headers, and a signed random gallery image background applied only after the authorized manifest loads. `/gallery/test/` shares the same background treatment, collage styling, and now renders/handles filter chips. Upload tiles remain inside month detail grids; months with existing media still show `Upload pictures` as the final card.
- 2026-06-16 gallery polish validation: `node --check gallery/app.js` and `git diff --check` passed. Browser QA used temporary signed mocks at `http://127.0.0.1:8001/everyday-lilly-gallery-months-qa.html` and `http://127.0.0.1:8001/everyday-lilly-gallery-test-qa.html`: desktop months showed 12 cards, admin metadata, signed background, no console errors, no horizontal overflow; opening month 0 showed the upload tile last; mobile `390x844` had no horizontal overflow; test GIF filter reduced the collage to one card with no console errors.
- 2026-06-16 five-year gallery timeline: the authenticated months gallery now renders 60 month slots grouped into 5 year sections. Internal storage/upload month IDs stay `0-59`, but the UI shows family-facing labels as `Месец 1` through `Месец 60`, with year ranges `Месеци 1-12` through `Месеци 49-60` and per-year labels like `Година 5 · Месец 12`. Nested object keys and hero keys accept months `0` through `59`, and the upload URL Lambda validation allows the same range.
- 2026-06-16 month label validation: `node --check gallery/app.js` and `git diff --check` passed. Browser QA used temporary mock `http://127.0.0.1:8001/everyday-lilly-month-labels-qa.html`: overview rendered 5 sections/60 cards with no `Месец 0` text, first card `Година 1 · Месец 1`, last card `Година 5 · Месец 12`/`60`, and opening internal month `59` showed detail title `Месец 60`; console had no warnings/errors.

## Maintenance Notes

- Keep `index.html` and `index-bg.html` aligned for shared landing-page and auth-modal changes.
- Keep backend architecture decisions synced into `app/backend/README.md`.
- Do not commit Terraform state, local `terraform.tfvars`, or secrets.
- Pre-existing dirty files observed on 2026-06-15: `.DS_Store`, `everyday_stuff/.DS_Store`, and `images/.DS_Store`.
- Skill validation note: the official `quick_validate.py` failed on 2026-06-15 because both available Python runtimes lacked `PyYAML`; equivalent Ruby YAML/frontmatter checks passed.

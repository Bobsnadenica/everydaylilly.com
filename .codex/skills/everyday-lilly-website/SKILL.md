---
name: everyday-lilly-website
description: Project-local runbook for the Everyday Lilly website repository. Use when working in this repo on the static public site, root HTML/CSS/JS, English/Bulgarian mirrored pages, Cognito auth popup/callback flow, private gallery routes, companion microsites, Terraform backend notes, local browser smoke tests, or when resuming Everyday Lilly website work from .codex/memory.md.
---

# Everyday Lilly Website

## Start Here

Read `.codex/memory.md` before making changes. It carries the current repo facts, local testing notes, known issues, and decisions that are easy to lose between sessions.

Check `git status --short` before editing. Ignore pre-existing `.DS_Store` churn unless the user explicitly asks to clean it up.

## Repo Map

- Root website: `index.html`, `index-bg.html`, `style.css`, `script.js`, `images/`, `contactus.html`, `supportus.html`, `roadmap.html`, and privacy pages.
- Auth: `auth/auth.js` and `auth/callback.html` implement the Cognito Hosted UI popup/callback session flow.
- Gallery: `gallery/` contains signed-in gallery routes; `gallery/app.js` consumes the backend manifest and renders `months/` or `test/`.
- Companion microsites: `everyday_dandelion/`, `everyday_storage/`, and `everyday_stuff/`.
- Backend runbook and Terraform: `app/backend/README.md` and `app/backend/live/prod/`.

## Local Preview And QA

Preview the static site from the repo root:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Use `http://localhost:8000/` for browser QA. In this workspace, `http://127.0.0.1:8000/` has previously shown stale service-worker/cache state from another local project even while the raw Python server returned the correct Everyday Lilly HTML.

For root-page smoke tests, verify:

- Page title is `Everyday Lilly | Free Plant Timelapse Photography & Growth Tracking App`.
- DOM is not blank and there is no framework error overlay.
- Console has no relevant errors. The current static setup may show Tailwind CDN's production warning.
- Desktop carousel advances with `#carousel-next`.
- Mobile viewport around `390x844` loads without horizontal document overflow; check the carousel carefully because controls have previously collapsed to `0x0`.

## Editing Rules

- Keep English and Bulgarian root pages aligned when changing shared copy or login behavior.
- Update both `index.html` and `index-bg.html` for shared landing/auth UI changes.
- Keep public site assets under `images/`.
- Treat the backend gallery manifest as authoritative. Do not move access decisions solely into browser-side route logic.
- Read `app/backend/README.md` before touching Terraform or auth/gallery infrastructure values.
- Do not commit Terraform state files, local `terraform.tfvars`, or secrets.

## Memory Maintenance

After meaningful work, update `.codex/memory.md` with:

- What changed or what was checked.
- Commands and browser URLs that worked.
- New findings, known issues, or decisions.
- Any backend/auth values that future work depends on.

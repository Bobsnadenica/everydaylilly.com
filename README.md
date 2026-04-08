# everydaylilly.com

Official website repository for the Everyday app family, including Everyday Lilly, Everyday Dandelion, Everyday Filetrap, and supporting project pages. The site is implemented as a static multi-page website and is intended for GitHub Pages style hosting with the custom domain `www.everydaylilly.com`.

## Overview

This repository contains the public-facing marketing, roadmap, privacy, support, and contact pages for the Everyday apps. It is not a web application with a backend or build pipeline. Pages are authored directly in HTML, styled with a mix of shared CSS, inline page-level CSS, and Tailwind CSS via CDN, and enhanced with lightweight client-side JavaScript.

## Website Architecture

- Static multi-page architecture with no framework, bundler, or package manager.
- Root-level pages serve the main Everyday Lilly experience and shared support content.
- App-specific microsites live in dedicated subdirectories for companion products.
- Shared UI behavior is handled with small JavaScript helpers rather than a component framework.
- Hosting is file-based, which keeps deployment simple and makes each page independently editable.

### Root site

The root of the repository contains the main Everyday Lilly website and shared support pages:

- `index.html` - English landing page for Everyday Lilly.
- `index-bg.html` - Bulgarian landing page for Everyday Lilly.
- `roadmap.html` - public roadmap and known issues page.
- `privacypolicy.html` and `privacypolicy-bg.html` - privacy policy pages.
- `contactus.html` - shared contact page for the Everyday app family.
- `supportus.html` - support and donation page.

### Shared presentation layer

- `style.css` provides shared styling for the main landing experience and reusable UI elements.
- `script.js` powers the screenshot gallery lightbox, gallery pagination dots, app carousel behavior, keyboard navigation, and language-page switching for the root landing pages.
- `images/` contains screenshots, icons, hero imagery, and support assets used across the site.

### Companion app microsites

The site also includes separate microsites for other products in the Everyday family:

- `everyday_dandelion/` - landing page, roadmap, and privacy policy for Everyday Dandelion.
- `everyday_storage/` - landing page, roadmap, and privacy policy for Everyday Filetrap.
- `everyday_stuff/` - supporting pages for additional projects, including privacy content for Kids Clock Game.

These microsites are mostly self-contained. Their landing pages define their own visual systems with page-specific HTML, CSS, and JavaScript, while still linking back into the main site where appropriate.

## Localization Strategy

Localization is handled in two ways depending on the page:

- Separate translated documents for the main landing and main privacy pages, such as `index.html` and `index-bg.html`.
- In-page bilingual content on some newer pages, such as `contactus.html` and `everyday_storage/index.html`, where English and Bulgarian copy is toggled client-side using `data-lang` attributes and saved language preference in `localStorage`.

This mixed approach keeps the original landing pages simple while allowing newer sections to reuse a single file for both languages.

## Repository Structure

```text
.
├── CNAME
├── README.md
├── index.html
├── index-bg.html
├── roadmap.html
├── privacypolicy.html
├── privacypolicy-bg.html
├── contactus.html
├── supportus.html
├── script.js
├── style.css
├── images/
├── everyday_dandelion/
├── everyday_storage/
└── everyday_stuff/
```

## Local Development

Because the website is static, local preview only requires a simple file server from the repository root. For example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Notes:

- No install step is required.
- Some pages load Tailwind CSS and web fonts from CDNs, so an internet connection is needed for full visual parity during local preview.

## Deployment

The repository is structured for static hosting from the project root.

- `CNAME` configures the custom domain `www.everydaylilly.com`.
- GitHub Pages is the natural deployment target for this repository structure.
- No server-side runtime, database, or API deployment is required for the website itself.

## Content and Maintenance Notes

- Keep English and Bulgarian content aligned when updating shared messaging.
- Add new screenshots and icons under `images/` and reference them directly from the relevant pages.
- When introducing a new companion app, follow the existing microsite pattern: dedicated directory, landing page, roadmap page, privacy page, and links from the root landing experience.
- Since there is no build step, changes are reflected directly in the published HTML, CSS, and JavaScript files.

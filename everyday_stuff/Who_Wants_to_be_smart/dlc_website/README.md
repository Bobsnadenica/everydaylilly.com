# Who Wants to Be Smart? — DLC Website

Static site that hosts the `manifest.json` and question-pack ZIP files
for the [Who Wants to Be Smart?](https://github.com/) Flutter app.

---

## Quick Start

### 1. Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Source** and select the branch + root `/` (or `/dlc_website` if it lives in a sub-folder).
3. GitHub Pages will publish the site within ~60 seconds.  
   Your manifest URL will be:
   ```
   https://<your-username>.github.io/<repo-name>/manifest.json
   ```

### 2. Deploy to Netlify (alternative)

1. Import the repo in the [Netlify dashboard](https://app.netlify.com).
2. Set **Publish directory** to `dlc_website/` (if the entire mono-repo is imported).
3. Click **Deploy** — Netlify assigns a URL immediately.

---

## Pointing the Flutter App at This Server

Open `lib/core/constants/app_constants.dart` and update:

```dart
/// URL of the hosted manifest.json
static const dlcManifestUrl =
    'https://<your-username>.github.io/<repo-name>/manifest.json';
```

Then hot-restart the app. The DLC Store will fetch the manifest and display
all available packs.

---

## Building Pack ZIP Files

Requires **Python 3.8+** (no third-party packages needed).

```bash
# From the dlc_website/ directory:
python3 scripts/build_packs.py

# Build only one pack:
python3 scripts/build_packs.py --pack animals

# Validate without writing files:
python3 scripts/build_packs.py --dry-run
```

The script zips each `packs/<pack_id>/` folder and writes
`packs/<pack_id>_v<version>.zip` beside it.

---

## Directory Structure

```
dlc_website/
├── index.html              ← Single-page DLC showcase site
├── manifest.json           ← Machine-readable pack registry
│
├── packs/
│   ├── animals/
│   │   ├── questions.json  ← Pack source (20 questions)
│   │   └── images/         ← Optional: pack-specific images
│   ├── animals_v1.zip      ← Built by build_packs.py  ← git-ignored (large binary)
│   │
│   ├── colors_shapes/
│   │   └── questions.json
│   └── colors_shapes_v1.zip
│
└── scripts/
    └── build_packs.py      ← Pack validator + ZIP builder
```

---

## Adding a New Pack

1. **Create the source folder**
   ```
   dlc_website/packs/<pack_id>/questions.json
   ```
   Follow the schema (see below or `index.html#setup`).

2. **Validate & build**
   ```bash
   python3 scripts/build_packs.py --pack <pack_id>
   ```

3. **Update `manifest.json`**
   - Add a new object to the `packs` array.
   - Increment `total_packs`.
   - Bump `manifest_version`.
   - Set `download_url` to the ZIP's public URL.
   - Update `size_bytes` from the ZIP file size.

4. **Commit & push**
   The site redeploys automatically. App users see the new pack on next store refresh.

---

## questions.json Schema

```jsonc
{
  "pack_id":   "my_pack",       // matches the folder name
  "pack_name": "My Pack",
  "version":   1,               // increment on breaking changes
  "questions": [
    {
      "id":         "mp_q01",   // unique within the pack
      "text":       "Question text shown to the player",
      "difficulty": 1,          // 1 = beginner … 4 = hard
      "category":   "Science",  // freeform label for filtering
      "image_path": "images/q01.png",   // optional
      "choices": [
        { "id": "c1", "text": "Correct answer", "is_correct": true  },
        { "id": "c2", "text": "Wrong answer A",  "is_correct": false },
        { "id": "c3", "text": "Wrong answer B",  "is_correct": false },
        { "id": "c4", "text": "Wrong answer C",  "is_correct": false }
      ]
    }
  ]
}
```

Rules enforced by `build_packs.py`:
- Exactly **4 choices** per question.
- Exactly **1** `"is_correct": true` per question.
- All question `id` values are unique within the file.
- All required keys are present.

---

## manifest.json Schema

```jsonc
{
  "manifest_version": 2,
  "updated_at": "YYYY-MM-DD",
  "total_packs": 2,
  "packs": [
    {
      "id":             "animals",
      "name":           "Animal Kingdom",
      "description":    "Short description shown in the store card.",
      "version":        1,
      "download_url":   "https://…/packs/animals_v1.zip",
      "icon_emoji":     "🦁",
      "question_count": 20,
      "size_bytes":     8192,
      "categories":     ["Animals", "Sounds"],
      "difficulty":     1,
      "age_range":      "3-6",
      "author":         "WWTBS Team",
      "language":       "en-US"
    }
  ]
}
```

---

## .gitignore Recommendation

Add the compiled ZIPs to `.gitignore` and serve them as GitHub Release
assets (or Netlify LFS) if they grow large:

```gitignore
dlc_website/packs/**/*.zip
```

For small packs (< 1 MB) it is fine to commit the ZIPs directly.

---

## License

Question content is released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).  
Website source is MIT.

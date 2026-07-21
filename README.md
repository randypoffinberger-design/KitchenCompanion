# Kitchen Companion v0.9.2

Kitchen Companion is a static, installable recipe application for GitHub Pages. It supports recipe modules, personal recipes, recipe editing, scaling, timers, favorites, notes, shopping lists, sharing, backup/restore, pasted-text importing, and screenshot/photo OCR.

## v0.9.2 highlights

- Replaced the conflicting browser-only image reader with one cross-platform Tesseract.js OCR workflow.
- Supports one or multiple screenshots/photos, ordered page combination, overlap deduplication, and optional website-clutter cleanup.
- Uses two recognition passes and chooses the stronger result.
- Limits OCR canvas memory for unusually tall screenshots to reduce mobile browser crashes.
- Resets a failed OCR worker so a second attempt can succeed without reloading the app.
- Routes corrected OCR text through the same parser and recipe editor used by pasted recipe text.
- Retains recipe sharing, single-recipe import, full backup/restore, personal-recipe export, and pre-update safety snapshots from v0.8.0.

## Repository layout

Upload the contents of this folder directly to the root of the GitHub repository. Keep these files together:

- `index.html`
- `app.js`
- `styles.css`
- `kitchen-engine.js`
- `ocr-service.js`
- `service-worker.js`
- `app.webmanifest`
- `catalog.json` and the stable `.recipepack` module files already used by the repository

This engine package intentionally does not replace the repository's current `catalog.json` or recipe modules.

## OCR first-use requirement

Tesseract.js, its WebAssembly core, and English language model are loaded from pinned jsDelivr URLs. The first OCR run therefore requires internet access. Recipe viewing, editing, timers, notes, shopping lists, and installed modules remain local browser features.

## Updating an existing Home Screen installation

After uploading v0.9.2, open the GitHub Pages site in Safari and use **Settings → Check for app update**. If an older Home Screen installation remains stuck on an old service worker, remove the shortcut once and add it again from Safari.

## v0.9.2 cookbook management

Personal recipes support permanent deletion. Module recipes support persistent hiding and can be restored from Settings → Hidden Recipes. Timers use persistent finished states with dismissible repeating alarms, and scaled cup amounts favor practical kitchen measurements.

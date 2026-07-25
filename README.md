# Kitchen Companion v0.12.1

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

## v0.11.0 local profiles

Kitchen Companion now separates device-wide modules from profile-owned personal data. Existing v0.9.x installations are migrated automatically into a Primary Profile. Profiles use permanent UUIDs and can be exported individually, creating a migration path toward future server-backed accounts without storing transferable plaintext passwords.


## Smart safety checkpoints (v0.11.5.3)

Kitchen Companion keeps manual checkpoints separately from automatic recovery points. It retains up to 10 manual checkpoints and 5 automatic checkpoints. Automatic checkpoints are created only for meaningful events such as an engine update, changed daily data, imports, updates, restores, uninstalls, and destructive deletes.

In v0.11.5.4, required checkpoints and saves are read-back verified. Risky actions stop if protection cannot be verified, failed writes roll back, imported backups receive structural validation before restore, and damaged primary storage can recover from the newest valid checkpoint at startup.

## Smart shopping list (v0.12.0)

Shopping items use a clean ingredient name with separate quantity and recipe-source lines. Matching open ingredients combine into one item, store lists are divided into practical shopping groups, checked items move to the bottom, manual group corrections are remembered, and a preferred store is learned after the same ingredient is assigned there three times.

## Storage quota recovery (v0.12.1)

Routine checkpoints no longer duplicate complete installed recipe modules. Kitchen Companion automatically compacts older oversized checkpoints, keeps only the newest full-module recovery point, removes stale migration/update copies after verification, and reports approximate local storage usage in Settings. Use **Clean up storage** to run the optimization again manually.

# Kitchen Companion v0.9.0

## OCR engine

- Removed the obsolete `TextDetector` implementation from `app.js`.
- Made `ocr-service.js` the single owner of image recognition and OCR worker lifecycle.
- Fixed duplicate click handlers that could start two recognition paths for the same image selection.
- Added mobile-safe limits for very tall or very large screenshots.
- Added automatic OCR worker disposal and clean retry after a recognition failure.
- Preserved two-pass recognition, image ordering, cleanup, overlap deduplication, quality checks, and the AI-conversion fallback prompt.

## Release and update reliability

- Updated application, asset, service-worker, and cache versions to `0.9.0`.
- Kept automatic pre-update state snapshots and full backup/restore protection.
- Kept stable module compatibility; this package does not rename or replace recipe module files.

## Deployment note

Keep the existing `catalog.json` and recipe module files in the GitHub repository. Replace the engine/application files with the contents of this package.

OCR dependencies remain pinned to jsDelivr and require internet on first use.

## Completed feature set

- Personal recipes can now be permanently deleted with confirmation and cleanup of favorites, notes, timers, shopping references, and hidden-state metadata.
- Installed module recipes can be hidden without changing module JSON; hidden status survives refreshes and module updates.
- Settings now includes Hidden Recipes management with individual restore and Restore All.
- Finished timers remain visible, vibrate where supported, play a repeating Web Audio alarm, support independent dismissal, and may use browser notifications when permission is granted.
- Scaled cup quantities convert awkward eighths into practical combinations such as 1/4 cup + 2 tablespoons and 1/2 cup + 2 tablespoons.
- Recipe parsing now better detects titles, sectioned ingredients, times, yield, and numbered directions.
- OCR cleanup includes common fraction repairs and clearer section spacing before review.
- The service worker continues to replace old caches and can retain successfully fetched OCR runtime assets for later offline use.

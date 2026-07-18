# Kitchen Companion 0.8.0 OCR Preview

This update replaces the browser-only TextDetector path with Tesseract.js OCR.

## Included behavior

- Reads one or multiple screenshots/photos in the order selected.
- Reuses one OCR worker for every selected image to reduce memory and setup time.
- Preprocesses images with resizing, grayscale, and contrast adjustment.
- Shows per-image OCR progress.
- Keeps successful pages if one selected image fails.
- Places combined OCR text in the existing correction box.
- Sends corrected OCR text through the same recipe parser used by Paste Recipe Text.

## Important preview limitation

The OCR runtime, WebAssembly core, and English language data are loaded from pinned jsDelivr URLs on first use. This makes the preview practical to test on iPhone without adding several megabytes of binary files to the package yet. A later hardening pass should self-host those pinned assets in the repository and update the service worker for fully offline first-party OCR.

## Uploading

This update package intentionally omits catalog.json and recipe module files. Keep the current catalog and current recipe module already in GitHub. Upload/replace only the files in this package.


## v0.8.0 quality-of-life additions
- Sticky back button while viewing a recipe.
- Favorite/unfavorite directly from recipe cards.
- Main-screen Favorites filter that combines with module, category, and search filters.
- Clear filters button resets module and category selections together.

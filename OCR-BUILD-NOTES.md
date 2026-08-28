# Kitchen Companion v0.9.2 OCR Notes

Kitchen Companion uses Tesseract.js for browser-based OCR on iPhone, iPad, Android, and desktop browsers.

## Workflow

1. Select one or more screenshots or photos in reading order.
2. Kitchen Companion preprocesses each image and runs two OCR passes.
3. The stronger result is selected, optional website clutter is removed, and overlapping screenshot text is deduplicated.
4. The combined text opens in a correction box.
5. Corrected text passes through the same recipe parser and editor used by pasted recipes.

## v0.9.2 reliability changes

- `ocr-service.js` is now the only OCR controller.
- Large and unusually tall images are constrained to a mobile-safe canvas budget.
- A failed worker is terminated and recreated on retry.
- Low-quality results expose fallback instructions without discarding recognized text.

## Dependency note

The pinned Tesseract runtime, compatible LSTM processing cores, and English
`best_int` model are bundled inside `Vendor/tesseract-7.0.0/`. The service
worker installs them into a dedicated cache that normal application-version
cleanup preserves. Settings can verify and repair the six required runtime
files and request persistent browser storage where supported.

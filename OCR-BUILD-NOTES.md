# Kitchen Companion v0.9.0 OCR Notes

Kitchen Companion uses Tesseract.js for browser-based OCR on iPhone, iPad, Android, and desktop browsers.

## Workflow

1. Select one or more screenshots or photos in reading order.
2. Kitchen Companion preprocesses each image and runs two OCR passes.
3. The stronger result is selected, optional website clutter is removed, and overlapping screenshot text is deduplicated.
4. The combined text opens in a correction box.
5. Corrected text passes through the same recipe parser and editor used by pasted recipes.

## v0.9.0 reliability changes

- `ocr-service.js` is now the only OCR controller.
- Large and unusually tall images are constrained to a mobile-safe canvas budget.
- A failed worker is terminated and recreated on retry.
- Low-quality results expose fallback instructions without discarding recognized text.

## Dependency note

The Tesseract runtime, WebAssembly core, and English model are loaded from pinned jsDelivr URLs and require internet on the first OCR use.

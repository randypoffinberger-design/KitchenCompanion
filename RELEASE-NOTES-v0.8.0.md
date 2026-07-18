# Kitchen Companion v0.8.0

This engine-only preview does not include catalog.json or recipe module files.

## Added
- Share Recipe: Kitchen Companion JSON or plain text
- Optional inclusion of personal notes during sharing
- Import Shared Recipe into My Recipes
- Full Backup and Restore with Merge or Replace
- Export My Recipes
- Automatic pre-update local snapshot
- Two-pass Tesseract OCR with gentler preprocessing
- Common website-clutter cleanup and overlapping screenshot deduplication
- Low-confidence OCR warning and AI conversion prompt

## Fixed
- Sticky Back button no longer covers the recipe scale controls on mobile

## Important
The OCR runtime still downloads from jsDelivr on first use. Offline OCR assets are not yet bundled.

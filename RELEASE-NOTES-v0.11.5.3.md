# Kitchen Companion v0.11.5.3

## Smarter safety checkpoints

- Keeps up to 10 manual checkpoints separately from up to 5 automatic recovery points.
- Creates an engine-update checkpoint on the first launch of a new app version.
- Creates a daily startup checkpoint only when at least 24 hours have passed and meaningful saved data changed.
- Ignores routine timestamp-only changes when detecting changed data.
- Creates automatic recovery points before module imports, module updates, module uninstalls, shared-recipe imports, personal-recipe deletion, bulk shopping deletion, full-backup restoration, and checkpoint restoration.
- Compacts older duplicate and rapid-startup checkpoints.
- Labels checkpoints in Settings as Manual or Automatic with a plain-language reason.

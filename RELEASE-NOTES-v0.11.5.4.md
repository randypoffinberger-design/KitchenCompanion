# Kitchen Companion v0.11.5.4

## Verified data-integrity safeguards

- Verifies checkpoint writes by reading them back before reporting success.
- Stops destructive imports, updates, uninstalls, deletions, and restores if a required checkpoint cannot be created.
- Uses stricter full-backup validation, including schemas, dates, module structure, duplicate IDs, recipes, and saved-data field types.
- Rolls failed saves and restores back to the prior data instead of leaving a partial write.
- Restores checkpoints as exact Kitchen Companion storage snapshots instead of leaving newer app keys behind.
- Attempts startup recovery from the newest valid checkpoint when primary profile storage is damaged.
- Warns before an app update check when no exported full backup was made in the last seven days.
- Keeps the v0.11.5.3 smart retention policy: up to 10 manual checkpoints and 5 automatic recovery points.

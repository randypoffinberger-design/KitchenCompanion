# Kitchen Companion v0.12.1

## Storage quota recovery

- Converts routine and manual checkpoints to compact snapshots that protect profile-owned data without duplicating installed public recipe modules.
- Keeps at most one full-module automatic recovery point for module imports, updates, and uninstalls.
- Automatically converts older oversized checkpoints to the compact format on first launch.
- Removes stale legacy migration, pre-update, and rollback copies after a compact checkpoint is verified.
- Removes the redundant full-state pre-update copy; the verified pre-update checkpoint now provides that protection.
- Retries checkpoint-list replacement after removing the oversized old checkpoint record when Safari reports a quota error.
- Adds approximate storage usage, checkpoint scope labels, and a **Clean up storage** control to Settings.
- Compact checkpoint restore preserves the currently installed public modules while restoring profile data.

Active recipes, profiles, personal recipes, notes, favorites, shopping data, learned preferences, and settings are not deleted by automatic or manual storage cleanup.

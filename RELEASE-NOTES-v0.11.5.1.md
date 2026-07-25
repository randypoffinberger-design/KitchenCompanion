# Kitchen Companion v0.11.5.1

## Manual checkpoint fix

- Fixed the **Create safety checkpoint** button appearing to do nothing when the current data matched the newest automatic checkpoint.
- Manual checkpoints are now always created on request, even when no data changed.
- Added visible **Checkpoint created** confirmation on success.
- Added visible failure feedback instead of silently ignoring errors.
- Updated cache and service-worker versions so the fix deploys cleanly.

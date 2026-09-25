# Serenity Kitchen Development Journal

## Current version
0.21.46

## Current task
Server-first URL importer following the v0.21.45 baseline. Run `npm ci` and `npm run check` before publishing. Deploy the separately prepared server v0.1.6 update first. Current checks cover the release baseline, sync races, navigation, guided cooking, HTML recipe formats and importer routing. Real-device installed-app upgrades and authenticated cloud import verification remain release checks.

## Completed
- Rolling automatic local safety checkpoints (maximum five).
- Startup checkpoints limited to one per 24 hours; rapid duplicates compact automatically.
- Manual checkpoint and restore controls in Settings.
- Storage schema and migration status diagnostics.
- Built-in regression smoke checks.
- Consistent app, manifest, checkpoint, and service-worker versioning enforced by the release check.
- Previous release remains untouched as the rollback build.

## Release checklist
- [x] App shell versions match.
- [x] Storage backup created before initialization and restore.
- [x] Profile data normalization remains non-destructive.
- [x] Diagnostics cover core stored data and browser capabilities.
- [ ] Test installed PWA update on iPhone.
- [ ] Test manual checkpoint restore on a copy of real data.

## Working rules
1. One scoped feature or bug per build.
2. Never overwrite the latest known-good package.
3. Create a checkpoint before storage migrations or restores.
4. Run diagnostics and the release checklist before handoff.
5. Avoid unrelated architecture changes.


## v0.11.5.3 checkpoint policy
- Manual and automatic checkpoints have separate retention limits.
- Manual: up to 10; automatic: up to 5.
- Startup: only after an engine update, or after 24 hours when meaningful data changed.
- Automatic recovery points are created before imports, module updates/uninstalls, recipe deletion, bulk deletion, and restores.
- Volatile timestamps are ignored when checking whether data truly changed.

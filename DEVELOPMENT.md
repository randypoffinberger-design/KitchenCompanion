# Kitchen Companion Development Journal

## Current version
0.11.5.2

## Current task
Smart checkpoint spacing and data-loss prevention safeguards.

## Completed
- Rolling automatic local safety checkpoints (maximum five).
- Startup checkpoints limited to one per 24 hours; rapid duplicates compact automatically.
- Manual checkpoint and restore controls in Settings.
- Storage schema and migration status diagnostics.
- Built-in regression smoke checks.
- Consistent 0.11.5.2 cache-busting and service-worker versioning.
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

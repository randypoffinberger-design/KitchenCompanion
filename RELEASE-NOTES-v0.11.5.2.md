# Kitchen Companion v0.11.5.2

## Smarter automatic checkpoints

- Startup checkpoints are now limited to one per 24-hour period.
- Rapid duplicate startup checkpoints left from repeated reloads are compacted automatically.
- Manual checkpoints still create immediately whenever requested.
- A checkpoint before restoring older data still creates immediately.
- The rolling limit remains five checkpoints.

This keeps the safeguard list useful instead of filling it with nearly identical backups created seconds apart.

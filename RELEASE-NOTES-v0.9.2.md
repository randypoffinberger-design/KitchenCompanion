# Kitchen Companion v0.9.2

## Timer hotfix

- Fixed a regression that prevented recipe timers from starting.
- Removed an obsolete `ensureAudioContext()` call left behind when the alarm system moved to bundled HTML audio.
- Range timers such as “2–3 minutes” now start after choosing either duration.
- Single-duration recipe timers use the same corrected start path.

## Version and cache

- Updated app, engine, manifest, asset query strings, and service-worker cache references to v0.9.2.

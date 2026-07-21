# Kitchen Companion v0.9.1

## Timer bell
- Replaced the short synthesized ping with a bundled repeating bell recording.
- The bell loops while Kitchen Companion is visible until all finished alarms are dismissed.
- Added Bell sound, volume, and Test bell controls in Settings.
- Starting a timer also attempts to authorize later playback through the same media element.

## Screen wake
- Added Screen Wake Lock support.
- Default mode keeps the display awake while viewing a recipe or while timers are active.
- Wake lock is released when the app is backgrounded and automatically requested again when the user returns.
- Added recipes-only and Never options.

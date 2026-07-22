# Kitchen Companion v0.10.0

## Local profiles and storage foundation

- Adds multiple local profiles with permanent random profile IDs.
- Automatically migrates existing v0.9.x data into a **Primary Profile**.
- Keeps installed public modules and active timers shared on the device.
- Separates personal recipes, favorites, notes, hidden recipes, shopping data, stores, and personal settings by profile.
- Adds profile creation, switching, renaming, export, and protected deletion.
- Keeps the last active profile selected when the app reopens.
- Adds a profile-storage service so later server-backed accounts can replace the storage backend without rewriting recipe screens.
- Mirrors current device, module, and profile records into IndexedDB while retaining synchronous local storage as a compatibility and recovery layer for iPhone Home Screen PWAs.
- Preserves the pre-profile v0.9.x state as `recipeEngineState.v1.preProfiles` for rollback.

## Compatibility

- Existing modules continue to use module schema 1.x.
- Existing backups can still be restored into the active profile.
- Recipe timers and alarm behavior from v0.9.2 are retained.

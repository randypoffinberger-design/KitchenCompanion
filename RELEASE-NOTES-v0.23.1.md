# Serenity Kitchen 0.23.1 — resilient iPhone saves

- Reopens and retries the durable IndexedDB connection when iPhone closes it during an app lifecycle transition.
- Preserves the existing revision check, so reconnecting cannot overwrite newer data saved by another window or device.
- Keeps recipes, shopping lists, pantry data, recovery history, and pending household sync operations together in the same atomic save.
- Waits for an edited recipe to reach durable storage before closing the editor.
- Makes the unsaved-changes warning dismissible and places it in the page flow so the hamburger menu and backup controls remain reachable.
- Suppresses a dismissed warning until a save succeeds or a different storage error occurs.

No IndexedDB databases, object stores, recipes, shopping lists, or sync records are cleared or replaced by this update.

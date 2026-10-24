# Serenity Kitchen v0.23.3

- Stops loading every full browser-history snapshot inside each IndexedDB save transaction, avoiding a known iPhone WebKit memory and database-service failure path.
- Retains recovery-history pruning through a lightweight metadata index while leaving every older unindexed recovery copy untouched.
- Recognizes Safari's IndexedDB internal-server failure, stops repeated retries, and explains that existing saved data was not cleared.
- Adds **Reload SK** and **Dismiss** actions to the in-page warning without blocking the hamburger menu or backup controls.
- Preserves recipes, shopping lists, Pantry items, meal plans, sync queues, conflicts, and all existing IndexedDB records. No database is cleared or replaced.

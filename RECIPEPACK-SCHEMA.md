# RecipePack schema v1

A `.recipepack` is UTF-8 JSON data. It cannot contain executable code.

Required module fields: `schemaVersion`, `moduleId`, `name`, `version`, and `recipes`.
Every recipe requires a unique lowercase hyphenated `id`, a `name`, an `ingredientGroups` array, and an `instructions` array.

Recipe identity is scoped to its module in the app, but recipe IDs must still be unique within one module. Updating a module uses `moduleId`; recipe IDs preserve links, favorites, and future personal overlays across versions.

Uninstalling a module removes only the imported publisher data. User-created recipes and future copied variations live in separate personal storage. Favorites that point only to the removed module are cleaned up.

## Renaming or replacing a module

When a new module replaces an older module whose `moduleId` changed, add an optional `replacesModuleIds` array to both the new RecipePack and its `catalog.json` entry. Example: `"replacesModuleIds": ["old-module-id"]`. Kitchen Companion removes the old installed copy and preserves favorites when recipe IDs are unchanged. The module file's `moduleId` and `version` must exactly match its catalog entry.

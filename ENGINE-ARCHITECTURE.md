# Kitchen Companion Engine Architecture — v0.6.0 Preview

## Engine responsibilities
`kitchen-engine.js` owns schema validation, module normalization and installation, personal-module creation, flattened recipe identity, copied-recipe overlays, search indexing/filtering, slug creation, and unique recipe IDs.

## Application workflow responsibilities
`app.js` owns browser state, rendering, dialogs, timers, shopping-list workflow, service-worker updates, and user interactions. It consumes the engine instead of defining module rules itself.

## Module responsibilities
`.recipepack`/JSON modules remain passive UTF-8 JSON. Modules contain metadata and recipe data only; they cannot execute code or control application UI.

## Compatibility fixture
`recipes-to-fill-the-stomach-and-heart.recipepack` is the primary real-world compatibility fixture: schema v1, 105 recipes, 111 ingredient groups, and 1,001 ingredients.

## Included next-version UI changes
Recipe search now appears on the main recipe screen with a Clear button. Module and Category filters can be applied independently or together.

## Next engine extraction targets
1. Recipe parsing and structured editor services.
2. Individual recipe import/export envelope.
3. OCR ingestion adapter and review model.
4. Persistent storage adapter with migrations.
5. Shopping-list and timer services.


## Import pipeline

Plain text and OCR-derived text both pass through `KitchenCompanionEngine.parseRecipeText()`, then into the shared recipe editor. Image recognition remains a browser adapter; parsing and normalization remain engine responsibilities.

# Kitchen Companion v0.17.3

## Weekly meal planner (v0.17.3)

- Ensures locked mains and sides survive both individual and whole-day rerolls.
- Makes the Kitchen Companion header name a consistent Home button that
  returns to the unfiltered All Recipes screen from anywhere in the app.
- Prevents sauces, gravies, marinades, dressings, and other standalone
  components from being generated as complete meals.
- Gives complete entrées such as stuffed peppers priority over vegetable
  keywords so they do not fill side slots.
- Adds a seven-day planner with breakfast, lunch, dinner, and snack.
- Gives breakfast and lunch one side slot each and dinner two side slots.
- Supports manual choices, full-week generation, empty-slot filling, individual
  and day rerolls, locks, custom entries, leftovers, eating out, and skipped
  meals or days.
- Adds reusable weekly defaults such as eating out for every lunch.
- Adds per-recipe Often, Weekly, Occasionally, Rarely, and Never frequencies
  plus breakfast, lunch, dinner, snack, and side placement controls.
- Weights random choices using frequency, favorites, ratings, and recent plan
  history while avoiding unwanted repeats.
- Sends selected planned days and meals, including their side dishes, to the
  existing consolidated shopping list.
- Saves plans, preferences, and history locally per profile and includes them
  in profile backups.

## Selectable timer alarms (v0.16.30)

- Adds five alarm choices: Classic bell, Digital timer, Kitchen chime, Gentle
  reminder, and Urgent alarm.
- Saves the selected alarm with the active profile.
- Generates four tones in code, adding no new audio-file storage.
- Plays three complete cycles during preview and then stops automatically.
- Allows an active preview to be stopped early.
- Keeps a real completed timer repeating until it is dismissed.

## Mobile dialog stability (v0.16.29)

- Keeps Create Recipe, Edit Recipe, imports, profiles, shopping tools, and other
  standard dialogs centered while scrolling on phones.
- Locks open dialogs to vertical touch scrolling and contains horizontal
  overflow.
- Prevents iPhone from automatically zooming into dialog fields by using a
  mobile-safe 16-pixel form font.
- Preserves the existing Settings and full-screen Guided Cooking layouts.
- Leaves OCR and website recipe parsing unchanged.

## Website recipe metadata cleanup (v0.16.28)

- Converts extended ISO recipe durations into readable times.
- Normalizes common website category slugs to Kitchen Companion categories.
- Preserves recipe author, total time, difficulty, and Cook's Note metadata.
- Keeps imported website recipes in the existing review editor before saving.
- Leaves OCR recognition and OCR recipe parsing unchanged.

## Settings organization and guided voice controls (v0.16.27)

- Reorganizes the long Settings dialog into eight collapsible sections.
- Keeps App and updates expanded while other sections start collapsed.
- Adds a sticky Settings header with an always-available Close button.
- Locks touch scrolling to the vertical axis so the dialog stays centered.
- Adds a device voice selector, voice preview, speaking speed, and pitch.
- Saves guided voice preferences with the active profile.
- Uses the selected voice and adjustments throughout Guided Cooking.

## Guided Cooking opening hotfix (v0.16.26.1)

- Opens Guided Cooking before attempting any optional progress write.
- Prevents full or unavailable local storage from silently blocking the mode.
- Shows a non-blocking warning when resume progress cannot be saved.
- Repairs invalid legacy guided-progress state and safely skips malformed
  ingredient entries.

## Guided Cooking Mode (v0.16.26)

- Adds a phone-friendly, full-screen guided mode with one instruction at a time.
- Provides Back, Repeat, Next, Finish, and Exit controls.
- Reads steps aloud with the device's built-in speech synthesis when available.
- Reuses existing instruction-time detection so highlighted times can start KC
  timers without leaving guided mode.
- Keeps an ingredient checklist available in a collapsible panel.
- Remembers the current step locally when guided mode is exited.
- Uses KC's existing screen-wake setting and wake-lock recovery.
- Requires no AI, account, server, or paid service.

## Website recipe import and clearer OCR flow (v0.16.25)

- Adds **Import from website** to recipe creation.
- Extracts standard Recipe JSON-LD without AI and opens every result in the
  existing recipe editor for review.
- Includes a deployable fetch worker for recipe sites that block direct browser
  access. Add its URL to the `kc-url-import-endpoint` meta tag after deployment.
- Keeps **Parse and review** hidden until image recognition succeeds. Selecting
  or changing an image restores **Read images** and hides the parse action.
- Does not change OCR recognition or cleanup behavior.

## Durable local OCR package (v0.16.24)

- Includes the complete pinned OCR runtime and English model inside KC.
- Uses no external OCR runtime URLs.
- Keeps OCR in a stable cache that normal KC version updates do not delete.
- Shows offline OCR readiness and storage-protection status in Settings.
- Provides an Install or repair offline OCR button for missing or damaged files.
- Requests persistent browser storage where supported while acknowledging that users and operating systems can still clear website data.
- Leaves OCR recognition and parsing behavior unchanged.

## Previous v0.16.23 changes

## Exported-recipe OCR cleanup

- Uses the actual Southern Biscuits export as a permanent regression case.
- Removes ratings, difficulty, nutrition, and damaged webpage metadata from descriptions.
- Retains valid Total time information while discarding the surrounding clutter.
- Repairs attached and trailing step numbers plus parentheses split across OCR lines.
- Keeps parenthetical comments with their relevant cooking action.

## Previous v0.16.22 changes

## Single-file recipe sharing

- Shares only the `.kcrecipe` attachment on supported devices.
- Prevents the filename from appearing as a separate text item on iPhone.
- Retains the download fallback for browsers that cannot share files.

## Previous v0.16.21 changes

## Webpage and multi-image OCR regression fixes

- Removes attribution banners, author continuations, photo credits, ingredient-selection controls, and common webpage clutter.
- Separates merged yield, prep, active, cook, and total-time metadata.
- Repairs detached step numbers, parenthetical continuations, and embedded numbered directions.
- Recognizes additional cooking actions used by biscuit recipes.
- Keeps the more complete line when overlapping screenshots contain truncated and full variants.
- Includes a Southern Biscuits known-answer regression and 240 deterministic webpage-style simulations in `tests/ocr-regression.test.js`.

## Previous v0.16.20 changes

## Line-safe OCR heading repair

- Restricts Ingredients, Instructions, Filling, and Topping heading recovery to complete lines.
- Prevents ordinary instruction phrases such as “wet ingredients,” “dry ingredients,” and “whip filling” from becoming false section boundaries.
- Removes a root cause of lost instruction text and malformed ingredient groups discovered by the automated OCR regression harness.
- Treats all-caps ingredient-group labels as the end of the title area, so a first ingredient cannot become the recipe name.
- Gives the first plausible title line priority over a descriptive subtitle.
- Normalizes common OCR bullet substitutions and removes detached step-number debris.
- Ignores repeated ingredient-group labels that OCR displaces into the directions.
- Verifies the parser against 240 scans covering 12 recipes and 20 image-quality variants per recipe.
- Keeps Parse and review available when OCR detects missing or unreliable text.
- Requires confirmation before opening the populated editor and clearly identifies whether the likely problem is a truncated ending or broader recognition quality.
- Preserves all successfully recognized content so the user only needs to correct the affected portion.
- Adds two line-focused OCR passes covering only the lowest portion of the printed page.
- Detects abruptly truncated instruction endings and blocks automatic parsing until the user corrects or rescans them.
- Replaces the misleading completion message with a specific missing-ending warning.
- Prioritizes a reconstructed grouped-recipe result after its missing ending passes strict recovery evidence.
- Prevents the longer but incomplete main OCR result from outscoring and discarding the recovered final instruction.
- Replaces the overly broad final-direction crop with multiple tighter bottom-strip passes.
- Recovers a slightly misread Melt verb only when the remaining line visibly contains chocolate, tallow/Crisco, and until.
- Accepts OCR-generated bullet substitutions before a credible final Melt direction.
- Starts recovered text at the actual Melt word, excluding the misread bullet or margin mark.
- Tries multiple page-segmentation modes on a larger bottom-page region when a grouped recipe is missing its final Melt direction.
- Requires strong Melt plus chocolate or Dip evidence before adding recovered text.
- Separates a recovered Melt/Dip instruction from a preceding Freeze step and removes the duplicated trailing Dip fragment.
- Essential OCR corrections always run, independent of the optional clutter-cleanup setting.
- The setting now controls only clutter and duplicate suppression.
- Final-step recovery accepts credible ending actions and rejects duplicate Freeze fragments.
- Reads the bottom of grouped recipe pages separately to recover omitted final directions.
- Adds only a new action instead of replacing or duplicating clean steps.
- Protects the standard pancake wet/dry ingredient wording during parsing.
- Keeps the cleaner cropped directions instead of replacing them with a noisier full-page result.
- Uses full-page text only to append a confidently recognized missing Melt ending.
- Repairs several safe joined-word, spacing, duplicate-range, and common cooking-phrase OCR errors.
- Keeps dish titles and descriptive subtitles in their proper fields.
- Repairs OCR bullet substitutions, missing mixed-number spaces, and `1 egg`.
- Parses mixed-number ingredients as scalable numeric quantities.
- Keeps numbered “In another bowl…” directions separate.
- Reuses a strong full-page instruction ending when a crop omits the final step.
- Adds a rotated title-only recognition pass for angled or arched recipe names.
- Removes isolated trailing OCR marks from ingredients.
- Favors instruction recognition that preserves the complete final Melt/Dip and drying directions.
- Repairs missing separators in OCR time ranges.
- Recognizes `2–3 minutes`, `10 to 12 minutes`, and hour ranges as selectable timer ranges.
- Stops title selection at the first ingredient or recipe section.
- Prevents timed cooking directions from becoming recipe titles.
- Requires credible evidence before inserting a whole-page title into reconstructed columns.
- Prevents invalid title hints from becoming false ingredients.
- Keeps “room temperature” with the egg description instead of treating “room” as a unit.
- Preserves a likely whole-page recipe title when the ingredient columns are reconstructed separately.
- Rejects quantity-led ingredient lines as recipe titles.
- Separates the left and right ingredient crops without clipping the complete eggs line.
- Compares two OCR layouts for the instruction area.
- Repairs the tested temperature, filling-step, and dropped dipping-verb errors.
- Joins wrapped printed directions back into complete cooking steps.
- Preserves new-step verbs and removes section-heading or symbol-only debris from directions.
- Repairs common fraction, quantity, cooking-word, and pan-size OCR errors.
- Leaves recipes without an inferred category as **Uncategorized**.

## Flexible OCR recipe structure (v0.16.2)

- Accepts headingless instruction lists and grouped ingredients such as **Cake**, **Filling**, and **Topping**.
- Repairs section headings whose letters were separated by OCR.
- Switches from ingredients to instructions when an instruction begins, even without an Instructions heading.
- Uses recipe structure rather than exact heading names when determining whether a scan is usable.
- Prevents Total time from being mislabeled as Cook time.

## OCR reliability safeguards (v0.16.1)

- Crops black and empty image borders before recognition.
- Tries multiple image treatments and printed-page layout modes.
- Rejects results that do not contain a credible ingredient and instruction structure instead of sending corrupted text into the recipe editor.
- Still permits manual correction and review before parsing.

## In-app feedback and bug reports (v0.16.0)

- Adds separate **Report a problem** and **Send feedback** flows inside Settings.
- Supports bug, suggestion, question, and general-feedback reports with an editable preview.
- Shares completed reports through the device share sheet, copies them as text, or downloads a dedicated `.kcfeedback` file.
- Accepts an optional screenshot and optional contact email.
- Includes optional anonymous diagnostics covering app/module versions, browser/device details, screen size, storage health, and startup errors.
- Excludes profile names and images, personal recipes, notes, shopping data, and backups from diagnostics and report files.
- Assigns every report a unique reference ID.

## Module-update recipe identity safeguards (v0.15.2)

- Repairs and deduplicates stale favorites left by recipe-ID changes within the same module.
- Migrates all saved recipe-linked information to the matching recipe before a catalog or manual module replacement.
- Uses exact permanent IDs first and a unique normalized recipe-name match only when an ID changed.

## Resilient module catalog (v0.15.1)

- Caches the latest successful catalog for limited-service use.
- Retries failed catalog requests and reports connection problems inline without Safari's service-worker error text.

## Recipe Ratings (v0.15.0)

- Provides profile-specific five-star ratings with card display, filtering, and sorting.
- Stores a numeric value and update timestamp under each permanent recipe identity for future Meal Planner weighting.
- Preserves and merges ratings through profile exports, full backups, restores, and catalog module-ID changes.

## Manual Cross-Links (v0.14.0)

- Adds searchable in-app recipe linking with directional **Uses** relationships and symmetric **Paired with** relationships.
- Saves links to the active profile by permanent recipe identity and includes them in profile exports and full backups.
- Manual links remain independent of module updates and can be removed from either connected recipe.

## Precise compact outgoing Cross-Links (v0.13.2)

- Prevents ordinary cooking directions from being treated as serving suggestions.
- Deduplicates links from the current recipe and shows them as concise **Uses:** and **Paired with:** lists.

## Compact reverse Cross-Links (v0.13.1)

- Deduplicates repeated references to the same recipe.
- Shows concise clickable recipe names without the matched instruction text.
- Separates ingredient-based **Used with:** links from serving-based **Paired with:** links.

## Cross-Link Phase 1 (v0.13.0)

- Finds ingredient and serving-suggestion connections across installed recipe modules.
- Opens a connected recipe directly or presents multiple choices when names overlap.
- Shows reverse **Used in** and **Pairs with** references on connected recipes.
- Navigates by permanent module-and-recipe identity and supports Back through connected recipes.
- Accepts optional recipe `crossLinkAliases` while remaining compatible with existing RecipePack v1 modules.

## Reliable offline startup (v0.12.15)

- Installed Home Screen navigation and versioned application assets use a cache-first strategy.
- A weak or stalled connection no longer blocks cached startup behind a network timeout.
- Tesseract.js is no longer a render-blocking startup dependency.
- OCR downloads on demand only when image recognition is selected, times out cleanly, and does not prevent the rest of Kitchen Companion from working offline.
- Previously cached jsDelivr OCR resources use the same cache-first path.

## Flour cleanup and consistent groups (v0.12.14)

- Shopping-title normalization supports mixed-number ranges written with `to` or a dash.
- Recovered ranges are retained in quantity details rather than discarded.
- Flour rules run before generic bread rules so bread flour and whole-wheat flour share `Spices & Baking`.
- Existing automatic `Bakery` assignments and stale preferences created by the previous edit behavior migrate to `Spices & Baking`.
- The stale-preference cleanup runs once, so category choices made intentionally after migration remain respected.
- Editing an item records a learned shopping group only after the group control is intentionally changed.

## Recipe items as regular items (v0.12.13)

- The regular-item checkbox is available when editing a shopping item added from a recipe.
- Checked edited items are added to or updated in Regular Items through the verified persistence path.
- Regular defaults retain the current item name, quantity, store, group, and aisle.

## Verified regular-item saving (v0.12.12)

- Manual shopping items selected as regular items are explicitly added or updated.
- Re-saving the same normalized item updates its defaults without creating a duplicate.
- Kitchen Companion verifies the persisted regular-item record before closing the form.

## Shopping lists through messages (v0.12.11)

- Share retains the dedicated `.kcshopping` file option and adds a copyable text-message format.
- The message includes a readable list plus an embedded machine-readable payload.
- Import accepts either the existing file or a complete pasted shopping-list message.
- Both routes validate and merge through the same duplicate-safe import pipeline while retaining stores, aisles, groups, quantities, and recipe sources.

## Home Screen identity (v0.12.10)

- Uses `Kitchen Companion` as both the full and short install name.
- Uses the red-and-black `KC` artwork for all Home Screen icon sizes.
- Does not alter existing profile colors or saved layout-color selections.

## Blank manual-item form (v0.12.9)

- Prevents the Add Item button's click event from being mistaken for an existing shopping item.
- Ensures the manual item-name field always opens blank instead of containing `undefined`.
- Rejects non-shopping-item values defensively before populating the edit form.

## Quick aisle editing (v0.12.8)

- Shows `Set aisle` or the remembered aisle directly beneath the store control on every shopping row.
- Allows the aisle to be set, changed, or cleared with one tap from the main shopping list.
- Shows the complete aisle location on its own line inside the expanded item card.
- Requires a store assignment first so aisle memory remains correctly tied to that ingredient and store.
- Displays the internal `Unassigned` destination as the shorter `No store` label throughout the shopping interface.

## Fault-tolerant startup (v0.12.7)

- Moves `init()` to the end of the application script so established shopping lists cannot access aisle/group constants before those constants exist.
- Attaches interface controls and starts update recovery before any migration or storage write.
- Isolates every startup task so a failed migration, save, diagnostic, render, timer, or wake-lock step cannot prevent later tasks from running.
- Removes the automatic save from inside shopping-data migration and performs it through the guarded startup pipeline.
- Displays a dismissible recovery notice when startup work is skipped because storage is unavailable.

## Shopping-title measurement cleanup (v0.12.6)

- Removes measurements embedded at the beginning of ingredient names, including compact Unicode fractions and parenthesized quantities.
- Moves recovered measurements into the shopping item's quantity detail instead of discarding them.
- Cleans existing affected shopping items automatically during migration.
- Normalizes `whole milk` to `Milk` and `active dry yeast` to `Active yeast` for cleaner shopping titles.
- Adds a store-specific aisle field and remembers a separate aisle for each ingredient at each store.
- Restores the remembered aisle when an ingredient is added or moved back to that store.

## Mixed-cache update recovery (v0.12.5)

- Prevents startup from stopping when iOS temporarily combines a newly updated `app.js` with the previous cached `index.html`.
- New shopping-list import controls are now attached defensively and cannot block the rest of the interface from loading.

## Shareable shopping-list files (v0.12.4)

- Share creates a dedicated `.kcshopping` file containing unchecked items, stores, shopping groups, quantities, and source details.
- Shopping lists can be imported directly from another Kitchen Companion user and safely merged with the active profile's list.
- Existing items, checked items, and personal store-learning preferences remain intact during import.
- Re-importing the same shared file skips entries that were already imported.

## Complete profile restoration (v0.12.3)

- Full replacement restores the backed-up profile name, color, avatar type, and profile picture along with its saved data.
- Merge mode clearly states that it retains the current profile identity and appearance.
- The restore summary identifies the profile contained in the selected backup.

## Startup and iPhone restore recovery (v0.12.2)

- Storage checkpoint cleanup, normalization, and optimization can no longer prevent the app from starting when browser storage is full or temporarily read-only.
- Existing profile and module data can load even when a nonessential startup write is rejected.
- The backup picker no longer filters by filename extension. Kitchen Companion validates the selected file's contents after selection, allowing `.kcbackup` files to be selected in iPhone Files.

Kitchen Companion is a static, installable recipe application for GitHub Pages. It supports recipe modules, personal recipes, recipe editing, scaling, timers, favorites, notes, shopping lists, sharing, backup/restore, pasted-text importing, and screenshot/photo OCR.

## v0.9.2 highlights

- Replaced the conflicting browser-only image reader with one cross-platform Tesseract.js OCR workflow.
- Supports one or multiple screenshots/photos, ordered page combination, overlap deduplication, and optional website-clutter cleanup.
- Uses two recognition passes and chooses the stronger result.
- Limits OCR canvas memory for unusually tall screenshots to reduce mobile browser crashes.
- Resets a failed OCR worker so a second attempt can succeed without reloading the app.
- Routes corrected OCR text through the same parser and recipe editor used by pasted recipe text.
- Retains recipe sharing, single-recipe import, full backup/restore, personal-recipe export, and pre-update safety snapshots from v0.8.0.

## Repository layout

Upload the contents of this folder directly to the root of the GitHub repository. Keep these files together:

- `index.html`
- `app.js`
- `styles.css`
- `kitchen-engine.js`
- `ocr-service.js`
- `service-worker.js`
- `app.webmanifest`
- `catalog.json` and the stable `.recipepack` module files already used by the repository

This engine package intentionally does not replace the repository's current `catalog.json` or recipe modules.

## OCR first-use requirement

Tesseract.js, its compatible LSTM processing cores, and the English language model are bundled under `Vendor/tesseract-7.0.0/`. The service worker installs them into a dedicated cache that survives normal Kitchen Companion updates. Settings reports whether all required files are ready offline and can repair them while connected. A device or user can still clear browser website data, so KC cannot promise that locally cached files are literally undeletable.

## Updating an existing Home Screen installation

After uploading v0.9.2, open the GitHub Pages site in Safari and use **Settings → Check for app update**. If an older Home Screen installation remains stuck on an old service worker, remove the shortcut once and add it again from Safari.

## v0.9.2 cookbook management

Personal recipes support permanent deletion. Module recipes support persistent hiding and can be restored from Settings → Hidden Recipes. Timers use persistent finished states with dismissible repeating alarms, and scaled cup amounts favor practical kitchen measurements.

## v0.11.0 local profiles

Kitchen Companion now separates device-wide modules from profile-owned personal data. Existing v0.9.x installations are migrated automatically into a Primary Profile. Profiles use permanent UUIDs and can be exported individually, creating a migration path toward future server-backed accounts without storing transferable plaintext passwords.


## Smart safety checkpoints (v0.11.5.3)

Kitchen Companion keeps manual checkpoints separately from automatic recovery points. It retains up to 10 manual checkpoints and 5 automatic checkpoints. Automatic checkpoints are created only for meaningful events such as an engine update, changed daily data, imports, updates, restores, uninstalls, and destructive deletes.

In v0.11.5.4, required checkpoints and saves are read-back verified. Risky actions stop if protection cannot be verified, failed writes roll back, imported backups receive structural validation before restore, and damaged primary storage can recover from the newest valid checkpoint at startup.

## Smart shopping list (v0.12.0)

Shopping items use a clean ingredient name with separate quantity and recipe-source lines. Matching open ingredients combine into one item, store lists are divided into practical shopping groups, checked items move to the bottom, manual group corrections are remembered, and a preferred store is learned after the same ingredient is assigned there three times.

## Storage quota recovery (v0.12.1)

Routine checkpoints no longer duplicate complete installed recipe modules. Kitchen Companion automatically compacts older oversized checkpoints, keeps only the newest full-module recovery point, removes stale migration/update copies after verification, and reports approximate local storage usage in Settings. Use **Clean up storage** to run the optimization again manually.

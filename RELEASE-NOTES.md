# Serenity Kitchen v0.20.0

## v0.20.0

- Introduces a reusable app-wide interior design system with three-level surfaces, restrained depth, consistent controls, Serenity red, and Tiffany-blue status styling.
- Adds accessible light and dark palettes plus safe-area-aware sticky headers and controls for Safari and installed iPhone PWAs.
- Adds a fixed, monochrome SK skillet-and-steam watermark behind every interior view using a small offline SVG asset.
- Refines the shared header and replaces the stopwatch and Meal Planner lock/action emoji with a consistent SVG line-icon family.
- Adds branded page-heading cards with matching line icons and live recipe, shopping, pantry, and week summaries.
- Compresses recipe filters into chips while retaining every existing filter, sort choice, clear behavior, and saved default.
- Refines recipe cards with a restrained red edge, quieter categories, compact metadata, and preserved pantry/crosslink indicators.
- Consolidates infrequent Shopping List management tools into a More actions menu without removing any action.
- Retains compact Shopping and Pantry expansion patterns, adding Pantry category counts and refined low-stock/filter states.
- Improves Meal Planner hierarchy, day summaries, sticky action placement, and Tiffany-blue locked-meal treatment without changing planner behavior.
- Adds reduced-motion support, accessible focus states, long-name handling, and consistent press feedback.

## v0.19.5

- Collapses every Pantry item to a slim row showing only its complete name.
- Expands an item when its name or chevron is tapped to show the amount on hand, conversion and restock information, quantity controls, Edit, and Remove.
- Keeps only one Pantry item expanded at a time.
- Closes expanded Pantry details when bulk-selection mode begins.
- Preserves the compact Pantry behavior and contrast in both light and dark themes.

## v0.19.4

- Restores full pantry item names, quantities, conversion details, and restock notes without truncation.
- Keeps pantry rows compact by placing their small controls beneath item information on phones.
- Adds an individual green, yellow, or red Pantry-readiness marker beside every recipe ingredient.
- Adds a compact Have / Check / Missing legend above recipe ingredients.
- Improves ingredient matching for preparation words, singular/plural produce, whole milk, fresh spinach, and garlic cloves.

## v0.19.3

- Slims Pantry items into compact, shopping-list-style rows.
- Adds Pantry word search, category filtering, and the existing low-stock filter in one compact toolbar.
- Adds tiny green, yellow, and red Pantry-readiness markers to recipe cards.
- Uses outlined readiness markers for a recipe linked as an ingredient, distinguishing it from the solid whole-recipe marker.
- Treats estimated, incompatible, and naturally variable quantities—such as heads and cloves of garlic—as yellow instead of claiming an exact amount.
- Tunes readiness colors and marker borders separately for light and dark themes.

## v0.19.2

- Migrates the stored public publisher on both Starter Kitchen recipes to Serenity Kitchen without changing any IDs.

## v0.19.1

- Fixes the immediate recovery-mode warning caused by an unnecessary duplicate startup save.
- Allows validated external backups to restore without first duplicating the full library in limited browser storage.
- Makes recovery notices identify the actual startup failure.

## v0.19.0

- Rebrands the app as Serenity Kitchen by Serenity Valley Works.
- Adds the new full-screen Serenity Kitchen home and four direct feature destinations.
- Adds the compact Serenity Kitchen home logo to all non-home screens.
- Renames new backup files for Serenity Kitchen while preserving restoration of existing Kitchen Companion backups.
- Preserves all module IDs, recipe IDs, profile data, cross-links, and internal storage namespaces.

## v0.18.1

- Adds ingredient-specific package-to-recipe conversions to Pantry.
- Estimates cups from weight for common flours, sugars, salts, pepper, and
  butter.
- Separates table, kosher, sea, and pink Himalayan salt conversion profiles.
- Adds liquid-package, dozen, and butter-stick conversions.
- Adds automatic profile detection, manual profile override, and a live
  conversion preview.
- Clearly marks density-based Pantry quantities as approximate.

## v0.18.0

- Adds the first Pantry prototype with local, profile-specific inventory.
- Adds manual and bulk Pantry entry plus multi-select removal.
- Moves checked shopping purchases into Pantry and removes them from the trip.
- Groups Pantry by category and alphabetizes items within each category.
- Adds manual quantity adjustments, search, and a low-stock filter.
- Adds optional restock thresholds that repopulate the shopping list without
  duplicating an existing open item.
- Adds recipe ingredient matching and confirmation before Pantry deductions.
- Includes Pantry in backups, profile exports, restores, and normal upgrades.

## v0.17.5.2

- Adds a bulk Save as regular action to shopping-list selection mode.
- Updates existing regular items by normalized name instead of creating
  duplicates.
- Keeps selected items on the current shopping list after saving them as
  regular staples.
- Keeps a close button visible at the top of Regular Items while scrolling.
- Groups Regular Items by shopping category and alphabetizes each group.
- Adds bulk manual shopping-list entry with up to 250 items per batch.
- Accepts pasted lines, comma-separated items, bullets, checkboxes, and numbered
  lists.
- Extracts common quantities and consolidates duplicate item names.
- Allows a default store to be applied to the batch while preserving learned
  store behavior when No store is selected.
- Keeps the user's place in long recipe lists when opening a recipe and
  returning with the in-app Back button.
- Fixes squeezed and truncated meal names on phones by moving slot controls to
  a dedicated row below the recipe information.
- Makes planned recipe names open their complete recipe page.
- Returns from a planned recipe to the same week in Meal Planner.
- Adds a dedicated change-recipe control beside each planned recipe.
- Automatically removes unused empty calendar weeks from local profile storage.
- Caps each profile at a rolling seventeen-week planning window: four previous
  weeks, the current week, and twelve future weeks.
- Fixes day and individual rerolls so locked planner choices are never cleared
  or replaced.
- Shows whether a reroll preserved one or more locked choices.
- Makes the Kitchen Companion header name return to the main All Recipes
  screen from the planner, shopping list, modules, and recipe details.
- Corrects automatic meal placement so standalone components such as Pizza
  Sauce are not generated as meals.
- Recognizes complete vegetable-based entrées such as Stuffed Peppers as mains
  instead of side dishes.
- Adds a profile-specific, locally stored weekly meal planner.
- Plans breakfast, lunch, dinner, and snack for Monday through Sunday.
- Adds one side slot to breakfast and lunch and two side slots to dinner.
- Supports manual planning, weighted random generation, rerolls, locks, meal
  and day skipping, eating out, leftovers, and custom text.
- Adds recurring weekly defaults and per-recipe frequency and placement
  preferences.
- Uses favorites, ratings, recent use, and saved frequency when generating.
- Transfers selected planned meals and sides into the consolidated shopping
  list with each planned recipe's scale.
- Preserves planner data through profile exports, backups, recipe module
  updates, and normal app upgrades.
- Leaves OCR, website extraction, Guided Cooking, and alarm behavior unchanged.

## v0.16.30

- Adds five selectable timer alarm tones in Settings.
- Saves alarm selection separately for each profile.
- Uses code-generated tones for four choices, avoiding additional sound files.
- Changes Preview alarm to play three complete cycles before stopping.
- Lets the user stop a preview early.
- Preserves continuous completed-timer alarms until dismissal.

## v0.16.29

- Keeps all standard modal screens horizontally contained and centered on
  phones.
- Limits dialog gestures to vertical scrolling.
- Prevents iPhone's automatic input-focus zoom inside dialogs.
- Excludes full-screen Guided Cooking from the generic modal sizing rules.
- Preserves OCR and website recipe extraction behavior.

## v0.16.28

- Fixes extended ISO durations such as Food Network's 20-minute values.
- Converts category slugs such as `side-dish` to **Side Dishes**.
- Adds recipe author, total time, difficulty, and Cook's Note metadata when
  supplied by the page.
- Preserves the existing OCR engine and OCR parsing behavior.

## v0.16.27

- Replaces the long Settings page with eight collapsible sections.
- Keeps the Settings Close control visible while scrolling.
- Prevents sideways Settings movement during touch scrolling.
- Adds device voice selection and preview for Guided Cooking.
- Adds saved speaking-rate and pitch controls.
- Preserves all existing settings and actions.

## v0.16.26.1

- Fixes Guided Cooking silently doing nothing when its initial local progress
  write fails.
- Makes guided progress persistence best-effort instead of blocking.
- Adds visible fallback errors for unexpected guided-mode opening failures.

## v0.16.26

- Adds full-screen Guided Cooking Mode.
- Displays one large instruction at a time with Back, Repeat, Next, Finish,
  and Exit controls.
- Adds optional on-device spoken instructions through browser speech synthesis.
- Offers timers for recognized cooking durations within guided steps.
- Includes a collapsible ingredient checklist.
- Saves guided progress locally per recipe and resumes at the saved step.
- Preserves the existing OCR, URL import, recipe parser, and timer behavior.

## v0.16.25

- Adds deterministic website recipe import from Recipe JSON-LD.
- Sends imported website recipes through the standard review editor before
  saving.
- Adds a constrained, deployable page-fetch worker for websites blocked by
  browser cross-origin rules.
- Shows **Read images** before OCR, then replaces it with **Parse and review**
  only after recognition succeeds.
- Resets the image import actions whenever the selected images change.
- Leaves OCR recognition and parsing rules unchanged.

## v0.16.24

## Durable local OCR package

- Bundles the pinned Tesseract.js 7.0.0 API, worker, compatible LSTM WebAssembly cores, and English `best_int` model inside Kitchen Companion.
- Removes all runtime dependence on external OCR CDN files.
- Stores the six required OCR files in a dedicated versioned cache that normal Kitchen Companion updates preserve.
- Attempts to install the offline OCR package when the service worker installs without blocking the rest of KC if the device is temporarily offline.
- Adds an Offline image recognition status panel in Settings.
- Adds an Install or repair offline OCR control that verifies and redownloads every required file.
- Requests persistent browser storage during manual repair when the browser supports it.
- Clearly explains that no browser can prevent the operating system or user from clearing website data under every circumstance.
- Adds an automated cache-lifecycle regression proving the OCR package survives normal app-cache replacement.
- Preserves the existing OCR recognition and parsing behavior.

## Previous v0.16.23 changes

## Exported-recipe OCR cleanup

- Adds the actual imperfect Southern Biscuits export as a permanent parser regression case.
- Removes merged ratings, difficulty, nutrition, and garbled webpage metadata from recipe descriptions.
- Preserves a valid embedded Total time as a recipe note before discarding surrounding webpage clutter.
- Removes attached step numbers such as `3 Turn` and trailing markers such as `4.`.
- Repairs closing parentheses stranded at the start of the following OCR line.
- Keeps parenthetical cautions and comments attached to the directions they qualify.
- Recognizes Make and Reform as cooking actions alongside the biscuit-specific actions added previously.

## Previous v0.16.22 changes

## Single-file recipe sharing

- Sends only the actual `.kcrecipe` file through the device share sheet.
- Stops iPhone from preserving the recipe filename as a second plain-text item.
- Keeps the normal browser-download fallback unchanged.

## Previous v0.16.21 changes

## Webpage and multi-image OCR regression fixes

- Rejects recipe attribution banners, photo credits, author continuations, and common webpage ingredient controls.
- Separates yield, prep, active, cook, and total-time fields when a webpage OCR pass merges them onto one line.
- Removes detached numbered-step markers without dropping the instruction that follows.
- Keeps parenthetical instruction continuations with the cooking action they qualify.
- Recognizes common biscuit actions including Turn, Knead, Pat, and Brush as distinct directions.
- When overlapping screenshots contain short and complete versions of the same line, retains the more complete version.
- Adds a portable known-answer regression case based on the Southern Biscuits failure and 240 deterministic webpage-style variants.

## Previous v0.16.20 changes

## Line-safe OCR heading repair

- Anchors OCR section-heading reconstruction to complete lines.
- Stops normal occurrences of “ingredients,” “filling,” and “topping” inside recipe directions from being rewritten as headings.
- Preserves “Pour the wet ingredients into the dry ingredients” as one instruction without relying on a downstream repair.
- Preserves “Whip filling until fluffy” instead of splitting Filling into a false section.
- Adds these cases to the automated known-answer regression suite.
- Prevents grouped ingredient labels such as `MEATBALLS:` and `DOUGH:` from allowing an ingredient to become the recipe title.
- Prefers the first plausible title line over a food-word-heavy subtitle.
- Converts common OCR bullet lookalikes into clean ingredient lines.
- Removes detached step numbers and repeated ingredient-group labels from directions.
- Expands automated coverage to 240 scans across clean, compressed, blurred, rotated, resized, contrast-adjusted, and cropped images.

## Previous v0.16.19 changes

## Warning without blocking review

- Changes low-confidence OCR from a hard parse block to an explicit confirmation warning.
- Allows the recognized recipe to populate the editor so users can preserve good OCR and manually repair only missing or damaged fields.
- Uses a specific missing-ending warning for truncated recipes and a broader review warning for generally unreliable scans.
- Continues to mark the result as questionable until the user chooses to proceed or edits the recognized text.

## Previous v0.16.18 changes

## Truncated-ending detection and lower-strip OCR

- Adds dedicated detail and threshold passes for the lowest 18 percent of a grouped recipe page.
- Detects suspicious instruction tails that end in incomplete connector words or very short unpunctuated fragments.
- Marks those scans unreliable and prevents Parse and review from silently accepting a recipe with missing final directions.
- Tells the user specifically to check the bottom of the recognized text, crop closer, or correct it before parsing.

## Previous v0.16.17 changes

## Recovered-ending selection safeguard

- Marks a reconstructed recipe when its final direction passes the strict Melt plus chocolate and tallow/Crisco-or-Dip evidence rules.
- Gives that verified reconstruction enough selection weight to defeat an otherwise longer but incomplete whole-page OCR result.
- Does not boost reconstructed pages when no credible missing ending was found.

## Previous v0.16.16 changes

## Focused bottom-strip recovery

- Moves final-direction recovery closer to the bottom of grouped recipe pages instead of asking Tesseract to reinterpret most of the directions section.
- Compares balanced, detail, and threshold treatments using both column, block, and sparse-text segmentation.
- Repairs a corrupted Melt verb only when the same recognized line still provides strong chocolate plus tallow/Crisco evidence.
- Keeps the existing prohibition against inventing a final instruction from ingredients alone.

## Previous v0.16.15 changes

## OCR bullet-tolerant final recovery

- Recognizes a final Melt direction even when Tesseract substitutes an unexpected character for its printed bullet.
- Discards everything before the Melt word and retains the existing Melt plus chocolate/Dip evidence requirement.
- Preserves the action-aware instruction cleanup introduced in v0.16.14.

## Previous v0.16.14 changes

## Action-aware instruction cleanup

- Splits separate sentences into guided-cook-sized steps when each sentence begins a clear cooking action.
- Repairs missing OCR punctuation between consecutive capitalized commands, such as “Mix well Mix in egg yolks.”
- Separates high-confidence assembly transitions such as unroll, fill, roll, freeze, dip, and tap off excess.
- Keeps warnings and cautions such as “Do not overmix” attached to the action they qualify.
- Preserves introductory phrases such as “In a medium bowl, whisk…” and avoids splitting ordinary ingredient lists or closely related actions.
- Retains the already-clean Simple Pancakes instruction structure while improving the Swiss Rolls stress test.

## Previous v0.16.13 changes

## Focused final-instruction recovery

- Expands grouped-layout bottom-page recognition and compares detail and threshold passes.
- Recovers an ending only when it begins with Melt and contains credible chocolate or Dip language.
- Keeps the preceding Freeze instruction clean when a recovered Melt step repeats a previously fused Dip fragment.

- Always applies essential fraction, quantity, temperature, time-range, cooking-word, and spacing repairs.
- Limits the cleanup option to removable clutter and duplicate suppression instead of allowing core corrections to be bypassed.
- Restricts bottom-page recovery to credible final actions such as Melt, Serve, Store, Chill, Cool, or Let.
- Prevents partial or duplicated Freeze text from being appended as a new ending.
- Adds a focused bottom-page OCR pass for final directions omitted by broader page recognition.
- Appends only the first genuinely new action and its continuation; already recognized final-area steps are ignored.
- Adds parser-level restoration of “wet ingredients” and “dry ingredients” so it works even when optional OCR cleanup misses the phrase.
- Prevents a noisier full-page instruction pass from replacing a cleaner cropped result.
- Allows the full-page pass to contribute only a missing final direction beginning with Melt.
- Repairs duplicate time-range prefixes, joined words such as `Mixwell`, apostrophe spacing, pan-size spacing, and common `layer` or `tightly` recognition errors.
- Restores “wet ingredients” and “dry ingredients” in the standard pancake mixing direction when OCR drops both nouns.
- Prioritizes dish-name titles such as **Simple Pancakes** over descriptive subtitles containing “recipe.”
- Removes common `e`, `o`, or degree-symbol bullet substitutions before ingredient quantities.
- Restores missing spaces in mixed numbers such as `11/2`, `31/2`, and `11/4` when followed by measurement units.
- Repairs `legg` as `1 egg` and parses mixed-number quantities correctly for recipe scaling.
- Recognizes “In another bowl…” as a new numbered direction instead of merging it with the preceding step.
- Uses the strongest full-page instruction tail as another candidate for preserving final directions.
- Adds a rotated title-region OCR pass for angled or arched headings such as “HOMEMADE SWISS ROLLS.”
- Removes isolated trailing OCR marks from otherwise valid ingredient lines.
- Prefers an instruction-region result that retains Melt/Dip and “let dry” ending text.
- Keeps a recovered Melt direction as a separate final step.
- Repairs missing OCR separators in time ranges such as `2 3 mins` to `2–3 mins`.
- Normalizes “10 to 12 minutes” and equivalent second/hour ranges to a consistent range.
- Makes both `to` and dash-based minute or hour ranges offer separate timer choices.
- Restricts recipe-title selection to text before the first ingredient or recipe section so later directions cannot become the title.
- Rejects timed instruction fragments such as “rolls. Freeze for 30 minutes.” as recipe titles.
- Only injects a whole-page title hint into column reconstruction when it has credible recipe-title evidence.
- Prevents rejected title hints from becoming false Main-group ingredients.
- Treats “room” as part of “room temperature eggs,” not as a measurement unit.
- Removes a duplicated “your” and retains the Freeze/Dip text in the final direction.
- Carries the likely recipe title from whole-page recognition into a column-based reconstruction instead of mistaking the first ingredient for the title.
- Prevents quantity-led ingredient lines such as “4 room temperature eggs” from being selected as recipe titles.
- Narrows the left ingredient crop after the full eggs line to avoid pulling fragments from the neighboring Filling column.
- Compares two printed-page layouts for the instruction region to improve recovery of the final directions.
- Repairs `350 1 Grease` as `350°F. Grease`.
- Retains **filling** when a printed Filling heading appears between “Whip” and “until fluffy.”
- Repairs “a layer of filling” and a dropped **Dip** verb when those instruction fragments are otherwise structurally clear.
- Joins OCR-wrapped instruction lines into complete steps instead of presenting every printed line as a separate step.
- Keeps instruction verbs such as Whip, Freeze, Unravel, Melt, and Dip as the start of distinct steps.
- Removes stray Cake, Filling, and Topping headings from the instruction list and discards symbol-only fragments.
- Repairs common OCR fraction forms such as `3 4 cups` and `1 2 cup`.
- Repairs common leading quantity substitutions such as `I tablespoon`, `| teaspoon`, or `[ tablespoon`.
- Cleans several high-confidence cooking-word errors such as coffee, egg, half, separated, fluffy, and yolks.
- Repairs common `9 x 13 pan` recognition errors.
- Uses **Uncategorized** when an imported recipe contains no category instead of silently selecting Appetizers.

## Flexible OCR recipe structure

- Recognizes valid recipes that use ingredient group headings such as **Cake**, **Filling**, and **Topping** without a literal Ingredients heading.
- Detects the first instruction-style line and moves from ingredients to instructions even when the image contains no Instructions heading.
- Repairs OCR-spaced headings such as `FI LLI N G` and `TOP PI NG` before recipe parsing.
- Uses structural ingredient and instruction evidence when evaluating OCR quality instead of requiring exact section-heading words.
- Improves imported title selection and treats Active time as prep time.
- Preserves Total time as a note instead of incorrectly presenting a multi-day resting period as Cook time.

## OCR reliability safeguards

- Automatically removes large empty or black borders before recognition so the recipe page receives the available OCR resolution.
- Compares normal grayscale, high-contrast, and adaptive-threshold recognition passes with layout modes suited to printed pages.
- Scores OCR confidence, recipe headings, broken text, and noise instead of accepting the longest result.
- Blocks unreliable scans from silently filling the recipe editor with invented times, gibberish ingredients, or blank instructions.
- Allows a user-corrected low-quality result to continue after manual review.
- Adds clearer capture guidance for full-resolution page photos and separate close ingredient/instruction photos.

## In-app feedback and bug reports

- Adds separate **Report a problem** and **Send feedback** controls to Settings.
- Keeps the entire form in Kitchen Companion and opens the normal phone share sheet for completed reports.
- Falls back to **Download Report** when file sharing is unavailable and also provides **Copy report** for messages or email.
- Collects bug severity, activity, actual behavior, expected behavior, suggestions, questions, optional contact email, and an optional screenshot.
- Generates an editable human-readable preview and a dedicated `.kcfeedback` JSON file with a unique report ID.
- Adds optional anonymous diagnostics for the app and installed public module versions, browser/device details, display size, storage health, current app view, and startup errors.
- Explicitly excludes profile names and images, personal recipes, notes, shopping lists, stores, saved preferences, and backups.
- Keeps screenshots as separate user-selected attachments instead of embedding them in diagnostic data.

## Module-update recipe identity safeguards (v0.15.2)

- Repairs stale title-based favorite references already left behind by a previous module update.
- Deduplicates favorite storage so the menu count and Favorites filter agree.
- Matches recipes by permanent ID first, then by a unique normalized recipe name when an editorial update changes recipe IDs.
- Carries favorites, ratings, notes, hidden status, manual Cross-Links, shopping-source links, timers, and personal-copy origins forward before replacing a module.
- Applies the same migration to catalog updates and manually imported replacement modules.
- Keeps the verified full-module safety checkpoint in place before an update changes saved recipe references.

## Resilient module catalog

- Saves each successful GitHub module catalog response under one reusable cache key.
- Reuses the saved catalog when cellular or Wi-Fi service is unavailable.
- Retries catalog loading without the cache-busting query before reporting failure.
- Replaces Safari's `FetchEvent.respondWith` failure alert with a clear inline status and **Try again** button.
- Distinguishes a missing `catalog.json` file from a temporary connection failure.

## Recipe Ratings (v0.15.0)

- Adds profile-specific 1–5 star ratings to every recipe.
- Shows saved ratings on recipe cards and recipe detail pages.
- Filters recipes by rated, unrated, exact five-star, four-stars-and-up, or three-stars-and-up status.
- Sorts by name, highest rating, lowest rating, or most recently rated.
- Saves rating values with timestamps so future Meal Planner weighting can use the same data without migration.
- Migrates legacy numeric ratings into the structured rating format.
- Includes ratings in profile exports, full backups, and duplicate-safe backup merging.
- Preserves ratings, notes, hidden status, timers, shopping sources, copied-recipe origins, and manual Cross-Links when a catalog module changes its module ID.

## Manual Cross-Links

- Adds an **Add link** control to every recipe, including recipes with no automatic connections.
- Searches all enabled installed recipes by recipe or module name.
- Supports “this recipe uses,” “selected recipe uses this,” and “these recipes pair together” relationships.
- Shows manual links in the same compact **Uses**, **Used with**, and **Paired with** lists as automatic links.
- Allows manual links to be removed without editing a RecipePack.
- Stores manual links by permanent `moduleId:recipeId` identity in the active profile.
- Includes manual links in local checkpoints, profile exports, full backups, and backup merges.

## Precise compact outgoing Cross-Links (v0.13.2)

- Cooking directions such as “spoon over the top” no longer create false serving connections.
- The current recipe's connections are deduplicated by target recipe.
- Compact **Uses:** and **Paired with:** lists replace repeated ingredient and instruction cards.

## Compact reverse Cross-Links (v0.13.1)

- Lists each connected dish only once even when it is mentioned in multiple ingredients or steps.
- Replaces repeated context cards with compact clickable recipe names.
- Separates ingredient relationships under **Used with:** from serving relationships under **Paired with:**.

## Cross-Link Phase 1 (v0.13.0)

- Discovers recipe connections across every installed and enabled module.
- Links ingredients to matching recipes, with an inline **View recipe** button for one match and a chooser when more than one recipe fits.
- Detects recipe names in serving suggestions and instructions, such as “Serve with garlic bread.”
- Adds reverse **Used in** and **Pairs with** cards so a component recipe shows which recipes refer to it.
- Preserves Back-button navigation while moving through connected recipes.
- Uses permanent `moduleId:recipeId` identities instead of names for navigation.
- Supports optional `crossLinkAliases` in RecipePack files for alternate names such as “marinara,” “red sauce,” or “pasta sauce.”
- Keeps existing RecipePack v1 modules compatible without requiring editorial changes.

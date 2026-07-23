# Kitchen Companion v0.11.1

## Shopping List 2.0 normalization fix

- Treats usage notes such as “for cooking,” “for frying,” “plus more,” “divided,” and common preparation terms as recipe notes rather than part of the grocery item name.
- Automatically merges existing duplicate shopping rows when their cleaned names and stores match.
- Preserves separate checked and unchecked rows so completed purchases are not merged back into the active list.
- Hides the awkward “No quantity” wording. Source-only entries now show the recipe name, “Manual item,” or “Regular item.”
- Capitalizes the first character of shopping item names consistently.

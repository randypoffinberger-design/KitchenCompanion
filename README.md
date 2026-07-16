# Recipe Engine v0.2

Open `index.html` in a modern browser. The engine is responsive and works offline on phones and computers.

## Module controls

Open **Modules** to import, enable, disable, export, or uninstall a `.recipepack` collection.

- **Disable** hides the module without deleting it.
- **Uninstall** removes the imported module and its recipes from that browser.
- User-created recipes and copied personal variations are designed to remain separate from publisher modules.
- Favorites pointing only to an uninstalled module are cleaned up.

## Validation

The importer validates module metadata, ID formatting, duplicate recipe IDs, ingredient groups, ingredient quantities, and instructions before installation. Invalid modules are rejected with recipe names and positions.

For command-line validation:

```bash
python tools/validate-recipepack.py path/to/module.recipepack
```

To repair duplicate IDs deterministically:

```bash
python tools/validate-recipepack.py input.recipepack --repair-duplicates --output fixed.recipepack
```

See `docs/RECIPEPACK-SCHEMA.md` for the format.

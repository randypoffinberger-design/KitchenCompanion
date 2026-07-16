#!/usr/bin/env python3
"""Validate Recipe Engine .recipepack files and optionally repair duplicate IDs."""
from __future__ import annotations
import argparse, json, re, sys
from collections import Counter
from pathlib import Path

REQUIRED_MODULE = ("schemaVersion", "moduleId", "name", "version", "recipes")
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "recipe"

def validate(data: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict): return ["Module root must be a JSON object."]
    for field in REQUIRED_MODULE:
        if field not in data: errors.append(f"Missing required module field: {field}")
    if data.get("schemaVersion") != 1: errors.append(f"Unsupported schemaVersion: {data.get('schemaVersion')!r}; expected 1")
    if not isinstance(data.get("recipes"), list): return errors + ["recipes must be an array."]
    ids: list[str] = []
    for index, recipe in enumerate(data["recipes"], 1):
        prefix = f"Recipe {index}"
        if not isinstance(recipe, dict): errors.append(f"{prefix} must be an object."); continue
        rid, name = recipe.get("id"), recipe.get("name")
        if not isinstance(rid, str) or not rid.strip(): errors.append(f"{prefix} is missing a valid id.")
        else:
            ids.append(rid)
            if not ID_RE.fullmatch(rid): errors.append(f"{prefix} ({name or 'unnamed'}) has invalid id {rid!r}.")
        if not isinstance(name, str) or not name.strip(): errors.append(f"{prefix} is missing a valid name.")
        groups = recipe.get("ingredientGroups")
        if not isinstance(groups, list): errors.append(f"{prefix} ({name or rid}) ingredientGroups must be an array.")
        else:
            for gi, group in enumerate(groups, 1):
                if not isinstance(group, dict) or not isinstance(group.get("ingredients"), list):
                    errors.append(f"{prefix} ({name or rid}) ingredient group {gi} must contain an ingredients array.")
                    continue
                for ii, ingredient in enumerate(group["ingredients"], 1):
                    if not isinstance(ingredient, dict) or not isinstance(ingredient.get("item"), str) or not ingredient.get("item", "").strip():
                        errors.append(f"{prefix} ({name or rid}) ingredient {gi}.{ii} needs an item string.")
                    q = ingredient.get("quantity") if isinstance(ingredient, dict) else None
                    if q is not None and not isinstance(q, (int, float)):
                        errors.append(f"{prefix} ({name or rid}) ingredient {gi}.{ii} quantity must be numeric or null.")
        if not isinstance(recipe.get("instructions"), list): errors.append(f"{prefix} ({name or rid}) instructions must be an array.")
    for rid, count in Counter(ids).items():
        if count > 1:
            names = [r.get("name", "unnamed") for r in data["recipes"] if r.get("id") == rid]
            errors.append(f"Duplicate recipe id {rid!r} used {count} times: {', '.join(names)}")
    return errors

def repair_duplicate_ids(data: dict) -> list[tuple[str, str, str]]:
    used: set[str] = set()
    changes: list[tuple[str, str, str]] = []
    for recipe in data.get("recipes", []):
        original = slugify(str(recipe.get("id") or recipe.get("name") or "recipe"))
        candidate = original
        if candidate in used:
            category = slugify(str(recipe.get("category") or "collection"))
            candidate = f"{original}-{category}"
            n = 2
            while candidate in used:
                candidate = f"{original}-{category}-{n}"
                n += 1
        if recipe.get("id") != candidate:
            changes.append((str(recipe.get("name", "Unnamed recipe")), str(recipe.get("id", "")), candidate))
            recipe["id"] = candidate
        used.add(candidate)
    return changes

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("file", type=Path)
    ap.add_argument("--repair-duplicates", action="store_true")
    ap.add_argument("--output", type=Path)
    args = ap.parse_args()
    try: data = json.loads(args.file.read_text(encoding="utf-8"))
    except Exception as exc: print(f"ERROR: {exc}", file=sys.stderr); return 2
    if args.repair_duplicates:
        changes = repair_duplicate_ids(data)
        output = args.output or args.file
        output.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        for name, old, new in changes: print(f"ID repaired: {name}: {old!r} -> {new!r}")
    errors = validate(data)
    if errors:
        print(f"INVALID: {len(errors)} problem(s)", file=sys.stderr)
        for error in errors: print(f"- {error}", file=sys.stderr)
        return 1
    print(f"VALID: {data['name']} v{data['version']} ({len(data['recipes'])} recipes)")
    return 0
if __name__ == "__main__": raise SystemExit(main())

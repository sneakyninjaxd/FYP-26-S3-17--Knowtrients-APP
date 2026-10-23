"""
Imports food composition data from the USDA FoodData Central API into the
`foods` table.

This runs once (or whenever the catalogue needs refreshing); it is not called
at request time. Food searches in the application query the local `foods`
table, so the system does not depend on an external service being available
while a user is logging a meal.

Setup
-----
Get a free API key at https://fdc.nal.usda.gov/api-key-signup/ and put it in
backend/.env:

    USDA_API_KEY=your-key-here

Usage, from the backend/ directory:

    python ml/import_usda.py --terms-file ml/usda_terms.txt
    python ml/import_usda.py --search "chicken breast" --limit 5
    python ml/import_usda.py --terms-file ml/usda_terms.txt --dry-run

Notes
-----
The free API key allows roughly 1,000 requests per hour, so the script paces
itself and reports how many requests it used.

Only Foundation and SR Legacy foods are imported. The Branded dataset holds
hundreds of thousands of commercial products that would swamp search results
for ordinary ingredients.
"""

import argparse
import os
import sys
import time
import urllib.parse
import urllib.request
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from app import models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402

API_ROOT = "https://api.nal.usda.gov/fdc/v1"

# Only analytical data types. Branded would drown out everything else.
DATA_TYPES = ["Foundation", "SR Legacy"]

# FoodData Central nutrient numbers, mapped to our columns.
#
# Each entry lists the acceptable nutrient IDs in order of preference. Energy
# needs three: ID 1008 was retired for Foundation Foods in October 2020, which
# now report 2047 (Atwater General Factors) or 2048 (Atwater Specific
# Factors) instead. A script that only looked for 1008 would import zeros for
# much of the Foundation dataset without any error.
NUTRIENT_MAP = {
    "calories": [1008, 2047, 2048],
    "protein_g": [1003],
    "carbs_g": [1005],
    "fat_g": [1004],
    "saturated_fat_g": [1258],
    "fiber_g": [1079],
    "sugar_g": [2000, 1063],   # total sugars; 1063 is the older identifier
    "sodium_mg": [1093],
}

# USDA food categories treated as vegetables when deriving servings.
VEGETABLE_CATEGORIES = {
    "Vegetables and Vegetable Products",
    "Legumes and Legume Products",
}

# A standard vegetable serving is taken as 80 g, following the Health
# Promotion Board's guidance, so 100 g of a vegetable is 1.25 servings.
# No food composition database records servings directly — this is a derived
# value and is documented as such in the preprocessing section of the PTD.
GRAMS_PER_VEGETABLE_SERVING = 80.0


def api_get(path: str, params: dict, api_key: str) -> dict:
    """One GET against the FDC API, returning parsed JSON."""
    params = {**params, "api_key": api_key}
    url = f"{API_ROOT}{path}?{urllib.parse.urlencode(params, doseq=True)}"

    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_nutrients(food: dict) -> dict:
    """
    Pulls our eight nutrition columns out of a FoodData Central record.

    Values are per 100 g, which is what both the API and our `foods` table
    use, so no conversion is needed.
    """
    # The API returns nutrients under different shapes depending on the
    # endpoint: search results nest the id under "nutrientId", while the
    # detail endpoint nests it under "nutrient": {"id": ...}.
    by_id: dict[int, float] = {}
    for entry in food.get("foodNutrients", []):
        nutrient_id = entry.get("nutrientId") or entry.get("nutrient", {}).get("id")
        amount = entry.get("value") if "value" in entry else entry.get("amount")
        if nutrient_id is not None and amount is not None:
            by_id[int(nutrient_id)] = float(amount)

    values = {}
    for column, candidates in NUTRIENT_MAP.items():
        values[column] = next(
            (by_id[c] for c in candidates if c in by_id), 0.0
        )
    return values


def derive_vegetable_servings(food: dict, nutrients: dict) -> float:
    """
    Estimates vegetable servings per 100 g.

    USDA records no such figure, but `vegetable_servings` is one of the
    model's ten input features, so it has to come from somewhere. Foods in a
    vegetable or legume category count as a full portion of vegetable by
    weight; everything else counts as none.

    This is deliberately crude. A mixed dish containing some vegetable will be
    recorded as zero, which understates intake rather than overstating it —
    the safer direction for a system that recommends eating more vegetables.
    """
    category = food.get("foodCategory")
    if isinstance(category, dict):
        category = category.get("description")

    if category in VEGETABLE_CATEGORIES:
        return round(100.0 / GRAMS_PER_VEGETABLE_SERVING, 2)
    return 0.0


def serving_size(food: dict) -> tuple[str | None, float | None]:
    """Returns a human-readable serving description and its weight in grams."""
    portions = food.get("foodPortions") or []
    for portion in portions:
        grams = portion.get("gramWeight")
        if not grams:
            continue

        measure = portion.get("measureUnit", {})
        unit = measure.get("name") if isinstance(measure, dict) else None
        amount = portion.get("amount")

        if unit and unit != "undetermined" and amount:
            return f"{amount:g} {unit} ({grams:g} g)", float(grams)
        if portion.get("portionDescription"):
            return f"{portion['portionDescription']} ({grams:g} g)", float(grams)
        return f"{grams:g} g", float(grams)

    return None, None


def clean_name(description: str) -> str:
    """
    USDA descriptions are upper case and comma-ordered ("CHEESE,CHEDDAR").
    Title-casing and tidying the spacing makes them readable in the app's
    search results.
    """
    name = description.strip()
    if name.isupper():
        name = name.title()
    return ", ".join(part.strip() for part in name.split(","))


def import_term(
    db, term: str, limit: int, api_key: str, dry_run: bool
) -> tuple[int, int, int]:
    """
    Imports up to `limit` foods matching one search term.

    Returns (added, skipped, requests_used).
    """
    try:
        result = api_get(
            "/foods/search",
            {
                "query": term,
                "dataType": DATA_TYPES,
                "pageSize": limit,
                "requireAllWords": "true",
            },
            api_key,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"  ! '{term}' failed: {exc}")
        return 0, 0, 1

    foods = result.get("foods", [])
    if not foods:
        print(f"  - '{term}': no results")
        return 0, 0, 1

    added = skipped = 0

    for food in foods:
        fdc_id = str(food.get("fdcId"))
        name = clean_name(food.get("description", ""))
        if not name:
            continue

        # Re-importing should be safe to run repeatedly, so an entry already
        # present from this source is left alone rather than duplicated.
        existing = (
            db.query(models.Food)
            .filter(models.Food.source_ref == fdc_id)
            .first()
        )
        if existing:
            skipped += 1
            continue

        if db.query(models.Food).filter(models.Food.name == name).first():
            skipped += 1
            continue

        nutrients = extract_nutrients(food)
        description, grams = serving_size(food)

        entry = models.Food(
            name=name,
            serving_description=description,
            serving_grams=grams,
            vegetable_servings=derive_vegetable_servings(food, nutrients),
            source="USDA FoodData Central",
            source_ref=fdc_id,
            is_verified=True,
            **nutrients,
        )

        if dry_run:
            print(
                f"  + {name[:48]:<48} "
                f"{nutrients['calories']:>6.0f} kcal  "
                f"fib {nutrients['fiber_g']:>5.1f}  "
                f"sod {nutrients['sodium_mg']:>6.0f}"
            )
        else:
            db.add(entry)

        added += 1

    if not dry_run:
        db.commit()

    print(f"  · '{term}': {added} added, {skipped} already present")
    return added, skipped, 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import foods from USDA FoodData Central."
    )
    parser.add_argument("--search", help="A single search term")
    parser.add_argument(
        "--terms-file", help="A file of search terms, one per line"
    )
    parser.add_argument(
        "--limit", type=int, default=3, help="Results per term (default 3)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be imported without writing anything",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Seconds between requests (default 0.5)",
    )
    args = parser.parse_args()

    api_key = os.getenv("USDA_API_KEY")
    if not api_key:
        raise SystemExit(
            "USDA_API_KEY is not set. Add it to backend/.env — get a free key "
            "at https://fdc.nal.usda.gov/api-key-signup/"
        )

    if args.search:
        terms = [args.search]
    elif args.terms_file:
        with open(args.terms_file, encoding="utf-8") as handle:
            terms = [
                line.strip()
                for line in handle
                if line.strip() and not line.startswith("#")
            ]
    else:
        parser.error("Pass either --search or --terms-file")

    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    url = str(engine.url)
    if engine.url.password:
        url = url.replace(engine.url.password, "***")
    print(f"Target database: {url}")
    print(f"{len(terms)} search term(s), up to {args.limit} result(s) each")
    if args.dry_run:
        print("DRY RUN — nothing will be written\n")
    else:
        print()

    total_added = total_skipped = total_requests = 0

    try:
        for term in terms:
            added, skipped, requests_used = import_term(
                db, term, args.limit, api_key, args.dry_run
            )
            total_added += added
            total_skipped += skipped
            total_requests += requests_used
            time.sleep(args.delay)

        count = db.query(models.Food).count()
        print(
            f"\n{total_added} added, {total_skipped} already present, "
            f"{total_requests} API request(s) used."
        )
        if not args.dry_run:
            print(f"Catalogue now holds {count} food(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()

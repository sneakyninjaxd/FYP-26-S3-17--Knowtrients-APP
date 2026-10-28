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

    python ml/import_usda.py --terms-file ml/usda_terms.txt --dry-run
    python ml/import_usda.py --terms-file ml/usda_terms.txt
    python ml/import_usda.py --search "chicken breast" --limit 5

Loading the live database
-------------------------
Pass the external database URL directly, rather than editing .env:

    python ml/import_usda.py --terms-file ml/usda_terms.txt --database-url "postgresql://..."

It applies to this one run only, so there's no .env to remember to switch
back afterwards. The script prints the target database before writing.

Datasets
--------
- Foundation and SR Legacy: analytical data for individual foods.
- Survey (FNDDS): prepared and mixed dishes — fried rice, curries, noodle
  dishes. The closest USDA has to the dishes people actually eat.
- Branded is excluded: hundreds of thousands of commercial products that
  would swamp search results for ordinary foods.

Serving sizes
-------------
Search results don't include portion data, so without a second step every
food would default to a 100 g serving. After searching, the script fetches
full details for each new food in batches of 20 and takes its first real
portion ("1 cup (158 g)"). About one extra request per 20 foods.

The free API key allows roughly 1,000 requests an hour. The script paces
itself and reports how many it used.
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request

# --database-url must take effect before the app's database module is
# imported, because the engine is created at import time. Reading it here,
# ahead of the imports, is what makes the flag work.
if "--database-url" in sys.argv:
    _i = sys.argv.index("--database-url")
    if _i + 1 < len(sys.argv):
        os.environ["DATABASE_URL"] = sys.argv[_i + 1]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()  # never overrides a DATABASE_URL set by the flag above

from app import models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402

API_ROOT = "https://api.nal.usda.gov/fdc/v1"

DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"]

# FoodData Central nutrient numbers, mapped to our columns, in order of
# preference. Energy needs three: ID 1008 was retired for Foundation Foods in
# October 2020, which report 2047 (Atwater General) or 2048 (Atwater
# Specific) instead. A script looking only for 1008 would import zeros for
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

# A standard vegetable serving is taken as 80 g, following the Health
# Promotion Board's guidance, so 100 g of a vegetable is 1.25 servings.
GRAMS_PER_VEGETABLE_SERVING = 80.0

# Portion descriptions that aren't a real serving size.
_NON_PORTIONS = {"quantity not specified", "undetermined"}

DETAIL_BATCH = 20


def api_get(path: str, params: dict, api_key: str):
    params = {**params, "api_key": api_key}
    url = f"{API_ROOT}{path}?{urllib.parse.urlencode(params, doseq=True)}"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def api_post(path: str, body: dict, api_key: str):
    url = f"{API_ROOT}{path}?{urllib.parse.urlencode({'api_key': api_key})}"
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_nutrients(food: dict) -> dict:
    """
    Pulls our eight nutrition columns out of a FoodData Central record.

    Values are per 100 g, which is what both the API and our `foods` table
    use, so no conversion is needed.
    """
    # Search results nest the id under "nutrientId"; the detail endpoint
    # nests it under "nutrient": {"id": ...}.
    by_id: dict[int, float] = {}
    for entry in food.get("foodNutrients", []):
        nutrient_id = entry.get("nutrientId") or entry.get("nutrient", {}).get("id")
        amount = entry.get("value") if "value" in entry else entry.get("amount")
        if nutrient_id is not None and amount is not None:
            by_id[int(nutrient_id)] = float(amount)

    return {
        column: next((by_id[c] for c in candidates if c in by_id), 0.0)
        for column, candidates in NUTRIENT_MAP.items()
    }


def derive_vegetable_servings(food: dict) -> float:
    """
    Estimates vegetable servings per 100 g.

    USDA records no such figure, but `vegetable_servings` is one of the diet
    model's inputs, so it has to come from somewhere. Foods in a vegetable or
    legume category count as a full portion of vegetable by weight;
    everything else counts as none.

    Category names differ between datasets — "Vegetables and Vegetable
    Products" in SR Legacy, "Dark green vegetables" in FNDDS — so the match
    is on the words rather than an exact list.

    Deliberately crude. A mixed dish containing some vegetable is recorded as
    zero, which understates intake rather than overstating it — the safer
    direction for a system that recommends eating more vegetables.
    """
    category = food.get("foodCategory")
    if isinstance(category, dict):
        category = category.get("description")
    text = (category or "").lower()

    if ("vegetable" in text or "legume" in text) and "potato" not in text:
        return round(100.0 / GRAMS_PER_VEGETABLE_SERVING, 2)
    return 0.0


def serving_size(food: dict) -> tuple[str | None, float | None]:
    """
    A readable serving description and its weight in grams, from the food's
    first real portion. Skips FNDDS placeholders like "Quantity not specified".
    """
    for portion in food.get("foodPortions") or []:
        grams = portion.get("gramWeight")
        if not grams:
            continue

        description = (portion.get("portionDescription") or "").strip()
        if description.lower() in _NON_PORTIONS:
            continue

        measure = portion.get("measureUnit") or {}
        unit = measure.get("name") if isinstance(measure, dict) else None
        amount = portion.get("amount")
        modifier = (portion.get("modifier") or "").strip()

        if unit and unit.lower() not in _NON_PORTIONS and amount:
            label = f"{amount:g} {unit}"
        elif description:
            label = description
        elif modifier and amount:
            label = f"{amount:g} {modifier}"
        else:
            label = f"{grams:g} g"
            return label, float(grams)

        return f"{label} ({grams:g} g)", float(grams)

    return None, None


def clean_name(description: str) -> str:
    """
    USDA descriptions are sometimes upper case and comma-ordered
    ("CHEESE,CHEDDAR"). Title-casing and tidying the spacing makes them
    readable in the app's search results.
    """
    name = description.strip()
    if name.isupper():
        name = name.title()
    return ", ".join(part.strip() for part in name.split(","))


def fetch_portions(fdc_ids: list[int], api_key: str) -> tuple[dict, int]:
    """
    Full details for the given foods, in batches of 20, keyed by FDC id.

    Returns the portions found and the number of requests used. A failed
    batch is skipped rather than aborting the import — those foods simply
    keep no serving size, as before.
    """
    found: dict[int, dict] = {}
    requests = 0
    for i in range(0, len(fdc_ids), DETAIL_BATCH):
        batch = fdc_ids[i : i + DETAIL_BATCH]
        requests += 1
        try:
            foods = api_post("/foods", {"fdcIds": batch, "format": "full"}, api_key)
        except Exception as exc:  # noqa: BLE001
            print(f"  ! portion lookup failed for {len(batch)} food(s): {exc}")
            continue
        for food in foods or []:
            if food.get("fdcId") is not None:
                found[int(food["fdcId"])] = food
        time.sleep(0.3)
    return found, requests


def import_term(
    db, term: str, limit: int, api_key: str, dry_run: bool, seen_names: set
) -> tuple[list, int, int]:
    """
    Finds up to `limit` foods for one search term.

    Returns (new_foods, skipped, requests_used). New foods aren't saved here;
    the caller adds serving sizes first, then saves them together.

    `seen_names` holds every name added so far in this run. The session has
    autoflush disabled, so an entry added a moment ago isn't yet visible to a
    query — without this set, two datasets returning "Broccoli, raw" in the
    same run would both be inserted.
    """
    try:
        result = api_get(
            "/foods/search",
            {"query": term, "dataType": DATA_TYPES, "pageSize": limit, "requireAllWords": "true"},
            api_key,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"  ! '{term}' failed: {exc}")
        return [], 0, 1

    foods = result.get("foods", [])
    if not foods:
        print(f"  - '{term}': no results")
        return [], 0, 1

    new_foods, skipped = [], 0
    for food in foods:
        fdc_id = str(food.get("fdcId"))
        name = clean_name(food.get("description", ""))
        if not name:
            continue

        if db.query(models.Food).filter(models.Food.source_ref == fdc_id).first():
            skipped += 1
            continue

        # Case-insensitive: USDA's datasets differ in capitalisation for
        # what is otherwise the same food.
        name_key = name.lower()
        if name_key in seen_names or (
            db.query(models.Food).filter(models.Food.name.ilike(name)).first()
        ):
            seen_names.add(name_key)
            skipped += 1
            continue
        seen_names.add(name_key)

        new_foods.append((food, name, fdc_id))

    print(f"  · '{term}': {len(new_foods)} new, {skipped} already present")
    return new_foods, skipped, 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Import foods from USDA FoodData Central.")
    parser.add_argument("--search", help="A single search term")
    parser.add_argument("--terms-file", help="A file of search terms, one per line")
    parser.add_argument("--limit", type=int, default=3, help="Results per term (default 3)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be imported without writing anything")
    parser.add_argument("--no-portions", action="store_true",
                        help="Skip fetching serving sizes (fewer requests)")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="Seconds between search requests (default 0.5)")
    parser.add_argument("--database-url",
                        help="Import into this database instead of the one in .env")
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
            terms = [line.strip() for line in handle if line.strip() and not line.startswith("#")]
    else:
        parser.error("Pass either --search or --terms-file")

    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    url = str(engine.url)
    if engine.url.password:
        url = url.replace(engine.url.password, "***")
    print(f"Target database: {url}")
    print(f"{len(terms)} search term(s), up to {args.limit} result(s) each")
    print("Datasets: " + ", ".join(DATA_TYPES))
    print("DRY RUN — nothing will be written\n" if args.dry_run else "")

    seen_names: set[str] = set()
    pending: list = []
    total_skipped = total_requests = 0

    try:
        for term in terms:
            new_foods, skipped, used = import_term(
                db, term, args.limit, api_key, args.dry_run, seen_names
            )
            pending.extend(new_foods)
            total_skipped += skipped
            total_requests += used
            time.sleep(args.delay)

        details = {}
        if pending and not args.no_portions:
            print(f"\nFetching serving sizes for {len(pending)} food(s)...")
            details, used = fetch_portions([int(f[2]) for f in pending], api_key)
            total_requests += used

        with_serving = 0
        for food, name, fdc_id in pending:
            nutrients = extract_nutrients(food)
            description, grams = serving_size(details.get(int(fdc_id), {}))
            with_serving += grams is not None

            entry = models.Food(
                name=name,
                serving_description=description,
                serving_grams=grams,
                vegetable_servings=derive_vegetable_servings(food),
                source="USDA FoodData Central",
                source_ref=fdc_id,
                is_verified=True,
                **nutrients,
            )

            if args.dry_run:
                serving = description or "100 g (no portion data)"
                print(
                    f"  + {name[:44]:<44} {nutrients['calories']:>5.0f} kcal  "
                    f"fib {nutrients['fiber_g']:>4.1f}  sod {nutrients['sodium_mg']:>5.0f}  "
                    f"| {serving}"
                )
            else:
                db.add(entry)

        if not args.dry_run:
            db.commit()

        print(
            f"\n{len(pending)} new, {total_skipped} already present, "
            f"{with_serving} with a serving size, {total_requests} API request(s) used."
        )
        if not args.dry_run:
            print(f"Catalogue now holds {db.query(models.Food).count()} food(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()

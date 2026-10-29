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
import re
import sys
import time
import urllib.error
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


class UsdaError(Exception):
    """A failed USDA request, carrying USDA's own explanation."""

    def __init__(self, status: int, message: str):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


# Every request made, including retries, so the total reported at the end is
# accurate — the free key allows about 1,000 an hour.
REQUEST_COUNT = 0


def _request(url: str, body: dict | None, api_key: str):
    global REQUEST_COUNT
    REQUEST_COUNT += 1
    full = f"{url}{'&' if '?' in url else '?'}{urllib.parse.urlencode({'api_key': api_key})}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        full,
        data=data,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST" if body is not None else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # The response body says why USDA refused — "Bad Request" alone
        # doesn't. Read it so a failure can actually be diagnosed.
        try:
            detail = exc.read().decode("utf-8", errors="replace").strip()
        except Exception:  # noqa: BLE001
            detail = ""
        raise UsdaError(exc.code, (detail or exc.reason or "no detail")[:300]) from None


def api_post(path: str, body: dict, api_key: str):
    return _request(f"{API_ROOT}{path}", body, api_key)


def api_get(path: str, params: dict, api_key: str):
    """
    A GET request, encoded exactly as the first import run did — the form
    USDA accepted for every term. urlencode with doseq repeats a list
    parameter (dataType=Foundation&dataType=SR+Legacy).
    """
    query = urllib.parse.urlencode(params, doseq=True)
    return _request(f"{API_ROOT}{path}?{query}", None, api_key)


# The two analytical datasets. Searched together with GET, these worked for
# every term across the earlier runs.
CORE_DATA_TYPES = ["Foundation", "SR Legacy"]

# Prepared and mixed dishes. Including this in the same request made about
# half of all searches fail with HTTP 400, so it is searched on its own, and
# a failure only loses the extra dishes for that term — not the whole term.
SURVEY_DATA_TYPE = "Survey (FNDDS)"

_survey_skipped = 0
INCLUDE_SURVEY = True

# Terms that failed outright, and how many in a row stop the run.
FAILED_TERMS = 0
STOP_AFTER_FAILURES = 5


def _search(term: str, data_types: list[str], page_size: int, api_key: str, attempts: int):
    """
    One search. Retries only failures that can fix themselves.

    A 5xx is a server hiccup and worth one more try. A 400 is never retried:
    USDA won't accept the same request on a second attempt, and retrying
    every refusal multiplied the request count until it hit USDA's limit of
    1,000 requests an hour per IP address — which then blocks every request,
    from every key, for an hour. A 429 (rate limited) stops immediately.
    """
    params = {"query": term, "dataType": data_types, "pageSize": page_size,
              "requireAllWords": "true"}
    last_error = None
    for attempt in range(attempts):
        try:
            return api_get("/foods/search", params, api_key).get("foods", [])
        except UsdaError as exc:
            last_error = exc
            if exc.status >= 500 and attempt + 1 < attempts:
                time.sleep(1.0 * (attempt + 1))
                continue
            break
    raise last_error


def search_foods(term: str, page_size: int, api_key: str, include_survey: bool = True) -> list:
    """
    Searches the core datasets, then the survey dataset separately.

    Core results come first: they're the analytical values for individual
    foods. Survey results follow, adding prepared dishes. If the survey
    search fails, the term keeps its core results; the term only fails if
    both searches do.
    """
    global _survey_skipped

    core, core_error = [], None
    try:
        core = _search(term, CORE_DATA_TYPES, page_size, api_key, attempts=2)
    except UsdaError as exc:
        core_error = exc

    survey = []
    if include_survey:
        try:
            survey = _search(term, [SURVEY_DATA_TYPE], page_size, api_key, attempts=2)
        except UsdaError:
            _survey_skipped += 1

    if core_error and not survey:
        raise core_error
    return core + survey


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

    found = {
        column: next((by_id[c] for c in candidates if c in by_id), None)
        for column, candidates in NUTRIENT_MAP.items()
    }

    # Some records give protein, carbohydrate and fat but no energy figure.
    # Energy is then derived with the Atwater factors (4, 4 and 9 kcal per
    # gram) — but only if all three are present. A record missing its
    # carbohydrate gave watermelon 4 kcal, and one missing its fat gave
    # mayonnaise 5 kcal: a partial sum is worse than no figure, because it
    # looks plausible. Without the full set, energy stays missing and the
    # food is skipped instead.
    if not found["calories"]:
        macros = [found[k] for k in ("protein_g", "carbs_g", "fat_g")]
        if all(m is not None for m in macros):
            derived = 4 * macros[0] + 4 * macros[1] + 9 * macros[2]
            if derived > 0:
                found["calories"] = round(derived, 1)

    return {k: (v if v is not None else 0.0) for k, v in found.items()}


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


# How suitable each kind of portion is as "one serving", best first.
#
# RACC (Reference Amount Customarily Consumed) and NLEA servings are the
# official US reference servings, so they win when present. After that,
# natural single units — a slice, an egg, a medium fruit. Kitchen and bulk
# measures come last: "1 tbsp" of boiled egg or "1 roast (848 g)" of pork
# are real portions but not what anyone means by one serving.
_PORTION_PREFERENCE = [
    ("racc", "nlea serving", "serving"),
    ("medium", "large", "small", "slice", "piece", "egg", "fruit", "item",
     "fillet", "breast", "thigh", "wing", "sandwich", "bar", "bag",
     "container", "bottle", "can", "patty", "cookie", "roll", "bun"),
    ("cup",),
    ("tablespoon", "tbsp"),
]
_PORTION_AVOID = ("guideline", "roast", "lb", "pound", "as ingredient", "yield")

# A plausible single serving, in grams. Outside this, a portion is only used
# if nothing better exists.
_SENSIBLE_GRAMS = (15, 600)

# Foods eaten by the spoonful. A cup of soy sauce, honey or butter isn't a
# serving anyone eats, so for these a spoon measure wins.
_SPOON_FOODS = (
    "sauce", "oil", "butter", "honey", "sugar", "syrup", "mayonnaise",
    "ketchup", "dressing", "jam", "spread", "vinegar", "ghee", "margarine",
)
_SPOON_WORDS = ("tablespoon", "tbsp", "teaspoon", "tsp")

# A "serving" carrying more energy than this is implausible as one serving —
# a cup of oil is about 1,900 kcal.
_MAX_SERVING_KCAL = 900


def _portion_label(portion: dict) -> str | None:
    description = (portion.get("portionDescription") or "").strip()
    measure = portion.get("measureUnit") or {}
    unit = measure.get("name") if isinstance(measure, dict) else None
    amount = portion.get("amount")
    modifier = (portion.get("modifier") or "").strip()

    if unit and unit.lower() not in _NON_PORTIONS and amount:
        return f"{amount:g} {unit}" + (f", {modifier}" if modifier and not modifier[0].isdigit() else "")
    if description:
        return description
    if modifier and amount:
        return f"{amount:g} {modifier}"
    return None


def is_spoon_food(name: str) -> bool:
    """
    True for condiments and fats, eaten by the spoonful.

    Matches whole words in the food's main name, so "hard-boiled" isn't read
    as containing "oil". A dish that merely comes with a sauce — "Spaghetti
    with meat sauce" — isn't a condiment either.
    """
    main = name.split(",")[0].lower()
    if re.search(r"\bwith\b", main):
        return False
    words = set(re.findall(r"[a-z]+", main))
    return bool(words & set(_SPOON_FOODS))


def serving_size(food: dict, name: str = "", kcal_per_100g: float = 0) -> tuple[str | None, float | None]:
    """
    The food's most sensible serving, as a readable label and grams.

    Scores every portion USDA lists rather than taking the first: official
    reference servings first, then natural units, then cups, then spoons —
    and anything outside a plausible single-serving weight last. Skips
    placeholders like "Quantity not specified".
    """
    best = None
    for portion in food.get("foodPortions") or []:
        grams = portion.get("gramWeight")
        if not grams:
            continue
        label = _portion_label(portion)
        if not label or label.lower() in _NON_PORTIONS:
            continue

        text = label.lower()
        rank = next(
            (i for i, words in enumerate(_PORTION_PREFERENCE) if any(w in text for w in words)),
            len(_PORTION_PREFERENCE),
        )
        if any(w in text.split() or w in text for w in _PORTION_AVOID):
            rank += 10
        low, high = _SENSIBLE_GRAMS
        if not low <= grams <= high:
            rank += 5

        # Condiments and fats: a spoon is the natural serving, a cup isn't.
        if is_spoon_food(name):
            if any(w in text for w in _SPOON_WORDS):
                rank = -1
            elif "cup" in text:
                rank += 6

        if kcal_per_100g and grams * kcal_per_100g / 100 > _MAX_SERVING_KCAL:
            rank += 8

        candidate = (rank, abs(grams - 150), label, float(grams))
        if best is None or candidate < best:
            best = candidate

    if best is None:
        return None, None
    _, _, label, grams = best
    return f"{label} ({grams:g} g)", grams


# Entries that aren't foods an adult user would log.
_EXCLUDED_PREFIXES = ("babyfood", "infant formula", "child formula")


def is_unwanted(name: str) -> bool:
    """
    True for entries that would clutter search with things nobody means:
    baby food, and branded products — "HOUSE FOODS Premium Firm Tofu",
    "RALSTON Corn Flakes". Branded entries in SR Legacy are written with the
    brand in capitals, which is how they're recognised.
    """
    lowered = name.lower()
    if lowered.startswith(_EXCLUDED_PREFIXES):
        return True
    if _CHAINS.search(name):
        return True
    words = re.findall(r"[A-Za-z][A-Za-z'-]+", name)
    return any(len(w) >= 4 and w.isupper() for w in words)


# Restaurant chains written in mixed case, which the capitals check misses.
_CHAINS = re.compile(
    r"\b(mcdonald'?s?|burger king|kfc|wendy'?s|subway|starbucks|domino'?s|"
    r"pizza hut|taco bell|chick-fil-a|dunkin|popeyes|arby'?s)\b",
    re.IGNORECASE,
)

# Words describing how a food is prepared. They appear in nearly every name,
# so they say nothing about whether a result is the food that was searched for.
_PREPARATION_WORDS = {
    "raw", "cooked", "boiled", "roasted", "fried", "baked", "grilled", "steamed",
    "canned", "plain", "whole", "fresh", "frozen", "dried", "sweet", "low", "fat",
}


# Words describing how a food is prepared. They appear in nearly every name,
# so they say nothing about whether a result is the food that was searched for.
# "Sweet" is deliberately not here: it belongs to sweet potato and sweet corn.
_PREPARATION_WORDS = {
    "raw", "cooked", "boiled", "roasted", "fried", "baked", "grilled", "steamed",
    "canned", "plain", "whole", "fresh", "frozen", "dried", "low", "fat",
    "and", "with", "or",
}

# Category words USDA puts in front of the food itself: "Fish, tuna",
# "Crustaceans, shrimp", "Nuts, almonds", "Beverages, coffee". For these the
# food is named in the segments that follow.
_CATEGORY_PREFIXES = {
    "fish", "crustaceans", "mollusks", "nuts", "seeds", "beverages", "snacks",
    "candies", "cereals", "cereals ready-to-eat", "squash", "fast foods",
    "restaurant", "spices", "alcoholic beverage", "onions",
}

# Different names for the same food.
_ALIASES = {
    "lychee": {"litchi"}, "litchi": {"lychee"},
    "scallion": {"onion", "scallion"}, "zucchini": {"zucchini", "squash"},
    "cola": {"cola", "carbonated"},
}


def _singular(word: str) -> str:
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    return word[:-1] if len(word) > 3 and word.endswith("s") and not word.endswith("ss") else word


def _words(text: str) -> list[str]:
    return [_singular(w) for w in re.findall(r"[a-z]+", text.lower())]


def name_key(name: str) -> str:
    """
    Comparison key that treats singular and plural as the same food.
    USDA lists "Banana, raw" and "Bananas, raw" in different datasets; both
    shouldn't be imported.
    """
    return " ".join(_words(name))


def is_relevant(name: str, term: str) -> bool:
    """
    True when the food is plausibly what was searched for.

    USDA's search only requires each word to appear somewhere in the name, so
    "rice" also finds "Pork sausage rice links" and "raisins" finds "Cookie,
    raisin". USDA names lead with the food itself, so the name's first word
    must be one of the search words: "Rice, white" passes, "Pork sausage rice
    links" doesn't.

    Except where USDA leads with a category — "Fish, tuna", "Nuts, almonds",
    "Beverages, coffee". The food is named in the next segments then, so
    those are checked instead. An earlier version checked only the first
    segment and rejected every fish, shellfish, nut and drink.
    """
    query = {w for w in _words(term) if w not in _PREPARATION_WORDS}
    if not query:
        return True
    for w in list(query):
        query |= _ALIASES.get(w, set())

    segments = [seg.strip().lower() for seg in name.split(",")]
    first = segments[0]

    if first in _CATEGORY_PREFIXES:
        # The category word itself doesn't count as a match, or "fish sauce"
        # would accept every fish.
        following = set(_words(" ".join(segments[1:3])))
        return bool((query - set(_words(first))) & following)

    head = _words(first)
    return bool(head) and head[0] in query


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
    # Ask for more than needed: some results are filtered out below, and the
    # term should still yield up to `limit` foods.
    try:
        foods = search_foods(term, limit * 2, api_key, include_survey=INCLUDE_SURVEY)
    except UsdaError as exc:
        global FAILED_TERMS
        FAILED_TERMS += 1
        print(f"  ! '{term}' failed: {exc}")
        return [], 0, 1

    if not foods:
        print(f"  - '{term}': no results")
        return [], 0, 1

    new_foods, skipped = [], 0
    for food in foods:
        if len(new_foods) >= limit:
            break
        fdc_id = str(food.get("fdcId"))
        name = clean_name(food.get("description", ""))
        if not name or is_unwanted(name) or not is_relevant(name, term):
            continue

        if db.query(models.Food).filter(models.Food.source_ref == fdc_id).first():
            skipped += 1
            continue

        # Case- and plural-insensitive: USDA's datasets differ in both for
        # what is otherwise the same food.
        key = name_key(name)
        if key in seen_names or (
            db.query(models.Food).filter(models.Food.name.ilike(name)).first()
        ):
            seen_names.add(key)
            skipped += 1
            continue
        seen_names.add(key)

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
    parser.add_argument("--no-survey", action="store_true",
                        help="Skip the survey dataset (prepared dishes); core foods only")
    parser.add_argument("--database-url",
                        help="Import into this database instead of the one in .env")
    args = parser.parse_args()

    global INCLUDE_SURVEY
    INCLUDE_SURVEY = not args.no_survey

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
    print("Datasets: " + ", ".join(CORE_DATA_TYPES + ([SURVEY_DATA_TYPE] if INCLUDE_SURVEY else [])))
    print("DRY RUN — nothing will be written\n" if args.dry_run else "")

    seen_names: set[str] = set()
    pending: list = []
    total_skipped = total_requests = 0

    try:
        consecutive_failures = 0
        for term in terms:
            # If USDA has refused several terms in a row, it's refusing
            # everything — usually the hourly limit. Carrying on would only
            # add requests and extend the block, so stop and say so.
            if consecutive_failures >= STOP_AFTER_FAILURES:
                print(
                    f"\nStopped: USDA refused {consecutive_failures} searches in a row. "
                    "This usually means its limit of 1,000 requests an hour per IP "
                    "address was reached, which blocks every request for an hour. "
                    "Wait an hour, then run this again — foods already found are "
                    "skipped, so nothing is duplicated."
                )
                break
            failures_before = FAILED_TERMS
            new_foods, skipped, used = import_term(
                db, term, args.limit, api_key, args.dry_run, seen_names
            )
            pending.extend(new_foods)
            consecutive_failures = consecutive_failures + 1 if FAILED_TERMS > failures_before else 0
            total_skipped += skipped
            total_requests += used
            time.sleep(args.delay)

        details = {}
        if pending and not args.no_portions:
            print(f"\nFetching serving sizes for {len(pending)} food(s)...")
            details, used = fetch_portions([int(f[2]) for f in pending], api_key)
            total_requests += used

        with_serving = incomplete = 0
        for food, name, fdc_id in pending:
            detail = details.get(int(fdc_id), {})

            # Search results sometimes omit a nutrient — Foundation foods'
            # energy especially — which reads as zero. The detail record has
            # the full set, so prefer it when it has an energy value.
            nutrients = extract_nutrients(food)
            if detail:
                full = extract_nutrients(detail)
                if full["calories"] > 0 or nutrients["calories"] == 0:
                    nutrients = full

            # A zero-calorie food that isn't a drink like water, coffee or tea
            # is missing its data rather than genuinely zero. Logging it would
            # silently record a meal as nothing.
            if nutrients["calories"] == 0 and not re.search(
                r"\b(coffee|tea|water|diet|zero|sugar[- ]free)\b", name.lower()
            ):
                incomplete += 1
                continue

            description, grams = serving_size(detail, name, nutrients["calories"])
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
            f"\n{len(pending) - incomplete} new, {total_skipped} already present, "
            f"{with_serving} with a serving size, {incomplete} skipped for missing data, "
            f"{REQUEST_COUNT} API request(s) used."
        )
        if INCLUDE_SURVEY and _survey_skipped:
            print(
                f"The survey dataset (prepared dishes) refused {_survey_skipped} of "
                f"{len(terms)} search(es); those terms still got their core results."
            )
        if not args.dry_run:
            print(f"Catalogue now holds {db.query(models.Food).count()} food(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()

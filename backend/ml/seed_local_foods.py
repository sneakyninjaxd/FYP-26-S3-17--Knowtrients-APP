"""
Adds common Singapore hawker dishes to the food catalogue.

USDA doesn't carry local dishes — chicken rice, laksa, nasi lemak — which are
what Singapore users eat most days. These come from HealthXchange, SingHealth's
health portal, which publishes nutrition for hawker dishes compiled by the
Department of Nutrition and Dietetics at KK Women's and Children's Hospital.

Every figure below is copied exactly as published: per serving, with the
serving weight. The script divides by that weight to get the per-100 g values
the catalogue stores, and keeps the serving so "1 serving" logs the right
amount. Each food records its source page in `source_ref`, so any value can be
traced back (constraint C-06).

Known gaps, stated rather than filled in:
- Sugar isn't published, so it's stored as 0. This understates sugar for
  sweet dishes; the diet model's sugar advice is less reliable for them.
- Vegetable servings aren't published either, so they're 0, as for USDA mixed
  dishes — understating rather than overstating vegetables.
- Values describe a typical portion. Stalls vary.

Usage, from the backend/ directory:

    python ml/seed_local_foods.py
    python ml/seed_local_foods.py --database-url "postgresql://..."

Safe to rerun: a dish already in the catalogue is skipped.
"""

import argparse
import os
import sys

# Must take effect before the database module is imported. See import_usda.py.
if "--database-url" in sys.argv:
    _i = sys.argv.index("--database-url")
    if _i + 1 < len(sys.argv):
        os.environ["DATABASE_URL"] = sys.argv[_i + 1]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402

SOURCE = "HealthXchange (SingHealth, KKH Nutrition & Dietetics)"

BASE = "https://www.healthxchange.sg/food-nutrition/food-tips/"
CHINESE_1 = BASE + "best-worst-singapore-hawker-chinese-food-dim-sum-char-kway-teow"
CHINESE_2 = BASE + "best-worst-singapore-hawker-chinese-food-duck-rice-fishball-noodle"
CHINESE_3 = BASE + "best-worst-singapore-hawker-chinese-food-hokkien-mee-lor-mee"
CHINESE_4 = BASE + "best-worst-singapore-hawker-chinese-food-wonton-mee"
MALAY = BASE + "best-worst-singapore-hawker-malay-breakfast-foods-nasi-lemak-mee-siam-soto"
INDIAN = BASE + "best-worst-singapore-hawker-indian-breads-prata-mutton-murtabak"

# (name, serving label, serving grams, kcal, protein g, fat g, saturated fat g,
#  fibre g, carbohydrate g, sodium mg, source page) — all PER SERVING, as published.
DISHES = [
    # Chinese, page 1
    ("Bak chang (rice dumpling)", "1 dumpling", 132, 276, 8, 10, 3.8, 3.3, 39, 486, CHINESE_1),
    ("Har gao (prawn dumpling)", "1 piece", 18, 27, 1, 1, 0.3, 0.4, 4, 74, CHINESE_1),
    ("Siew mai", "1 piece", 16, 29, 1, 1, 0.4, 0.3, 3, 99, CHINESE_1),
    ("Spring roll, deep fried", "1 roll", 22, 70, 1, 4, 1.7, 0.7, 7, 141, CHINESE_1),
    ("You tiao, stuffed with octopus paste", "1 piece", 18, 61, 1, 4, 1.5, 0.4, 6, 35, CHINESE_1),
    ("Ban mian", "1 bowl", 528, 475, 22, 22, 8.4, 3.2, 48, 2196, CHINESE_1),
    ("Char kway teow", "1 plate", 384, 744, 23, 38, 29.2, 7.3, 76, 1459, CHINESE_1),
    # Chinese, page 2
    ("Char siew rice", "1 plate", 327, 605, 24, 16, 11.9, 5.9, 91, 880, CHINESE_2),
    ("Chicken rice, roasted", "1 plate", 382, 607, 25, 23, 8.7, 2, 75, 1287, CHINESE_2),
    ("Chicken soup with Chinese herbs", "1 bowl", 534, 145, 24, 5, 1.8, 0.6, 1, 909, CHINESE_2),
    ("Duck rice, roasted", "1 plate", 410, 673, 24, 20, 5.9, 7.6, 99, 545, CHINESE_2),
    ("Duck rice, skin removed", "1 plate", 350, 530, 24, 11, 3.6, 3.4, 99, 326, CHINESE_2),
    ("Fishball noodles, dry", "1 plate", 327, 370, 19, 8, 3.3, 3.9, 55, 1645, CHINESE_2),
    ("Fishball noodles, soup", "1 bowl", 798, 551, 30, 10, 2.4, 8.8, 88, 2913, CHINESE_2),
    # Chinese, page 3
    ("Fried carrot cake (chai tow kway)", "1 plate", 295, 493, 2, 35, 14.1, 5.9, 42, 1289, CHINESE_3),
    ("Fried Hokkien prawn mee", "1 plate", 442, 522, 18, 19, 7.3, 4.4, 69, 1423, CHINESE_3),
    ("Fried rice, with egg, seafood and meat", "1 plate", 428, 907, 28, 33, 13.6, 0.9, 125, 1245, CHINESE_3),
    ("Kway chap", "1 serving", 611, 650, 33, 26, 11.6, 4.3, 70, 2303, CHINESE_3),
    ("Laksa lemak", "1 bowl", 540, 591, 17, 32, 17.8, 7, 58, 1588, CHINESE_3),
    ("Lor mee", "1 bowl", 540, 383, 15, 11, 4.9, 6.5, 55, 2538, CHINESE_3),
    ("Minced pork noodles (bak chor mee), dry", "1 plate", 311, 511, 20, 23, 9.2, 4.9, 57, 1491, CHINESE_3),
    # Chinese, page 4
    ("Minced pork noodles (bak chor mee), soup", "1 bowl", 597, 383, 18, 12, 4.8, 8.5, 50, 1740, CHINESE_4),
    ("Penang laksa", "1 bowl", 569, 377, 18, 2, 0.6, 4, 71, 2287, CHINESE_4),
    ("Porridge with minced pork and century egg", "1 bowl", 512, 224, 11, 5, 2.3, 2.5, 34, 834, CHINESE_4),
    ("Prawn mee, soup", "1 bowl", 574, 294, 19, 2, 1.1, 4, 49, 2422, CHINESE_4),
    ("Sliced fish bee hoon soup", "1 bowl", 686, 349, 22, 8, 3.5, 3.4, 48, 1413, CHINESE_4),
    ("Wonton mee, dry", "1 plate", 330, 411, 19, 12, 5, 5.3, 55, 1502, CHINESE_4),
    ("Wonton mee, soup", "1 bowl", 545, 290, 19, 5, 0, 1.6, 41, 1804, CHINESE_4),
    # Malay
    ("Nasi lemak, with fried egg and anchovies", "1 packet", 210, 494, 13, 14, 7.6, 6.5, 80, 838, MALAY),
    ("Mee hoon soto", "1 bowl", 902, 359, 20, 17, 6.8, 3.5, 31, 1537, MALAY),
    ("Lontong with sayur lodeh", "1 bowl", 775, 798, 46, 40, 21.9, 13.2, 64, 1930, MALAY),
    ("Mee siam", "1 plate", 655, 694, 28, 24, 8.6, 9.2, 92, 2659, MALAY),
    ("Mee rebus", "1 plate", 571, 571, 23, 17, 5.8, 8, 82, 2164, MALAY),
    ("Mee soto", "1 bowl", 541, 433, 19, 13, 5.4, 3.8, 60, 2678, MALAY),
    ("Curry puff", "1 piece", 37, 131, 4, 8, 3.8, 0.6, 11, 168, MALAY),
    ("Pisang goreng (banana fritter)", "1 piece", 65, 197, 1, 5, 3.4, 2.3, 36, 103, MALAY),
    # Indian
    ("Roti prata, plain (kosong)", "1 piece", 70, 209, 5, 7, 2.9, 1.7, 32, 386, INDIAN),
    ("Chapati", "1 piece", 60, 187, 4, 7, 3.1, 4.1, 28, 155, INDIAN),
    ("Roti john", "1 serving", 252.5, 721, 25, 35, 18.1, 11.3, 77, 2011, INDIAN),
    ("Naan", "1 piece", 131, 357, 11, 9, 4.2, 3.3, 57, 430, INDIAN),
    ("Murtabak, mutton", "1 serving", 211, 373, 15, 17, 7, 9.3, 39, 1365, INDIAN),
]


def per_100g(value: float, grams: float) -> float:
    return round(value * 100.0 / grams, 2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Add Singapore hawker dishes.")
    parser.add_argument("--database-url", help="Use this database instead of the one in .env")
    args = parser.parse_args()

    models.Base.metadata.create_all(bind=engine)

    url = str(engine.url)
    if engine.url.password:
        url = url.replace(engine.url.password, "***")
    print(f"Target database: {url}")

    db = SessionLocal()
    added = skipped = 0
    try:
        for (name, label, grams, kcal, protein, fat, sat, fibre, carbs, sodium, page) in DISHES:
            if db.query(models.Food).filter(models.Food.name.ilike(name)).first():
                skipped += 1
                continue
            db.add(
                models.Food(
                    name=name,
                    serving_description=f"{label} ({grams:g} g)",
                    serving_grams=float(grams),
                    calories=per_100g(kcal, grams),
                    protein_g=per_100g(protein, grams),
                    carbs_g=per_100g(carbs, grams),
                    fat_g=per_100g(fat, grams),
                    saturated_fat_g=per_100g(sat, grams),
                    fiber_g=per_100g(fibre, grams),
                    sugar_g=0.0,           # not published — see module docstring
                    sodium_mg=per_100g(sodium, grams),
                    vegetable_servings=0.0,
                    source=SOURCE,
                    source_ref=page,
                    is_verified=True,
                )
            )
            added += 1
        db.commit()
        print(f"Added {added} dish(es), {skipped} already present.")
        print(f"Catalogue now holds {db.query(models.Food).count()} food(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()

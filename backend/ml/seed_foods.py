"""
Seeds a small starter food catalogue so the search and logging screens have
something to return before the full nutrition dataset is imported.

Run from the backend/ directory:
    python ml/seed_foods.py

These entries are marked is_verified=False and sourced as 'placeholder'.
Constraint C-06 requires production nutrition values to come from the
designated open nutrition source, so this data must be replaced — the flag and
the source field make the unverified rows easy to find and delete later.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal, engine  # noqa: E402
from app import models  # noqa: E402

# name, serving description, serving grams, then per-100 g:
# kcal, protein, carbs, fat, sat fat, fibre, sugar, sodium, veg servings
FOODS = [
    ("White rice, cooked", "1 bowl (200 g)", 200, 130, 2.7, 28.0, 0.3, 0.1, 0.4, 0.1, 1, 0),
    ("Brown rice, cooked", "1 bowl (200 g)", 200, 123, 2.7, 25.6, 1.0, 0.2, 1.6, 0.4, 4, 0),
    ("Chicken breast, grilled", "1 piece (120 g)", 120, 165, 31.0, 0.0, 3.6, 1.0, 0.0, 0.0, 74, 0),
    ("Egg, boiled", "1 egg (50 g)", 50, 155, 13.0, 1.1, 11.0, 3.3, 0.0, 1.1, 124, 0),
    ("Wholemeal bread", "1 slice (40 g)", 40, 247, 13.0, 41.0, 3.4, 0.7, 7.0, 4.3, 400, 0),
    ("Banana", "1 medium (120 g)", 120, 89, 1.1, 22.8, 0.3, 0.1, 2.6, 12.2, 1, 0),
    ("Apple", "1 medium (180 g)", 180, 52, 0.3, 13.8, 0.2, 0.0, 2.4, 10.4, 1, 0),
    ("Broccoli, steamed", "1 cup (90 g)", 90, 35, 2.4, 7.2, 0.4, 0.1, 3.3, 1.4, 41, 1.1),
    ("Spinach, cooked", "1 cup (180 g)", 180, 23, 2.9, 3.6, 0.4, 0.1, 2.2, 0.4, 79, 1.1),
    ("Mixed salad", "1 bowl (150 g)", 150, 20, 1.4, 3.6, 0.2, 0.0, 1.8, 1.9, 28, 1.5),
    ("Salmon, baked", "1 fillet (150 g)", 150, 208, 20.0, 0.0, 13.0, 3.1, 0.0, 0.0, 59, 0),
    ("Tofu, firm", "1 block (150 g)", 150, 144, 15.8, 4.3, 8.7, 1.3, 2.3, 0.6, 14, 0),
    ("Chicken rice", "1 plate (400 g)", 400, 145, 8.9, 16.5, 5.1, 1.7, 0.6, 0.5, 320, 0.1),
    ("Nasi lemak", "1 plate (350 g)", 350, 180, 5.2, 22.0, 8.1, 4.2, 1.1, 1.8, 310, 0.2),
    ("Mee goreng", "1 plate (350 g)", 350, 155, 6.1, 21.0, 5.4, 1.9, 1.7, 3.2, 480, 0.3),
    ("Laksa", "1 bowl (500 g)", 500, 120, 4.8, 11.0, 6.6, 4.1, 0.9, 1.6, 420, 0.2),
    ("Instant noodles, prepared", "1 pack (350 g)", 350, 130, 3.1, 18.0, 5.2, 2.6, 0.9, 0.7, 520, 0),
    ("Greek yoghurt, plain", "1 tub (150 g)", 150, 59, 10.0, 3.6, 0.4, 0.1, 0.0, 3.2, 36, 0),
    ("Milk, full cream", "1 glass (250 ml)", 250, 61, 3.2, 4.8, 3.3, 1.9, 0.0, 5.1, 43, 0),
    ("Almonds", "1 handful (30 g)", 30, 579, 21.2, 21.6, 49.9, 3.8, 12.5, 4.4, 1, 0),
    ("Soft drink, cola", "1 can (330 ml)", 330, 42, 0.0, 10.6, 0.0, 0.0, 0.0, 10.6, 4, 0),
    ("Teh tarik", "1 cup (250 ml)", 250, 68, 1.8, 10.4, 2.2, 1.4, 0.0, 9.8, 32, 0),
    ("Potato chips", "1 small bag (50 g)", 50, 536, 7.0, 53.0, 34.6, 3.1, 4.4, 0.3, 525, 0),
    ("Chocolate bar, milk", "1 bar (45 g)", 45, 535, 7.6, 59.4, 29.7, 18.5, 3.4, 51.5, 79, 0),
]


def main() -> None:
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    added = 0

    try:
        for row in FOODS:
            (
                name, serving_desc, serving_g, kcal, protein, carbs,
                fat, sat_fat, fiber, sugar, sodium, veg,
            ) = row

            if db.query(models.Food).filter(models.Food.name == name).first():
                continue

            db.add(
                models.Food(
                    name=name,
                    serving_description=serving_desc,
                    serving_grams=serving_g,
                    calories=kcal,
                    protein_g=protein,
                    carbs_g=carbs,
                    fat_g=fat,
                    saturated_fat_g=sat_fat,
                    fiber_g=fiber,
                    sugar_g=sugar,
                    sodium_mg=sodium,
                    vegetable_servings=veg,
                    source="placeholder",
                    is_verified=False,
                )
            )
            added += 1

        db.commit()
        print(f"Seeded {added} food(s). Catalogue now holds {db.query(models.Food).count()}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

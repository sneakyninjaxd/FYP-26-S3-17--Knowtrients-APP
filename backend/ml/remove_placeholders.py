"""
Removes the 24 placeholder foods added by ml/seed_foods.py.

Those were only ever stand-ins so the app had something to search before real
data was imported. Constraint C-06 requires nutrition values to come from the
designated source, so they should go once USDA data is loaded.

Safe for existing logs: food logs store their own copy of the nutrition at
the time of logging, and the link to the food is set to empty rather than
deleting the log. Nobody's history changes.

Usage, from the backend/ directory:

    python ml/remove_placeholders.py              # shows what would go, asks first
    python ml/remove_placeholders.py --yes
    python ml/remove_placeholders.py --database-url "postgresql://..."
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove placeholder foods.")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    parser.add_argument("--database-url", help="Use this database instead of the one in .env")
    args = parser.parse_args()

    url = str(engine.url)
    if engine.url.password:
        url = url.replace(engine.url.password, "***")
    print(f"Target database: {url}")

    db = SessionLocal()
    try:
        placeholders = db.query(models.Food).filter(models.Food.source == "placeholder").all()
        real = db.query(models.Food).filter(models.Food.source != "placeholder").count()

        if not placeholders:
            print("No placeholder foods found. Nothing to do.")
            return

        print(f"{len(placeholders)} placeholder food(s) to remove; {real} real food(s) stay.")

        # Removing the placeholders before real data exists would leave food
        # search returning nothing at all.
        if real == 0:
            print("\nThere's no real food data yet — removing these would leave the")
            print("catalogue empty. Run ml/import_usda.py first.")
            return

        if not args.yes:
            if input("Type 'remove' to continue: ").strip() != "remove":
                print("Cancelled. Nothing was changed.")
                return

        ids = [f.id for f in placeholders]
        unlinked = (
            db.query(models.FoodLog)
            .filter(models.FoodLog.food_id.in_(ids))
            .update({"food_id": None}, synchronize_session=False)
        )
        for food in placeholders:
            db.delete(food)
        db.commit()

        print(f"Removed {len(placeholders)}. {unlinked} existing log(s) kept their nutrition values.")
        print(f"Catalogue now holds {db.query(models.Food).count()} food(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()

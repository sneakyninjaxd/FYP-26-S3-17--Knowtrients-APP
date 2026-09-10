"""
Drops every table and recreates them from the current models.

Needed when the schema changes, because SQLAlchemy's `create_all` only ever
adds tables — it never alters an existing one. A renamed or added column on a
table that already exists will not appear, and the app fails at runtime with a
missing-column error that looks like a code fault.

DESTRUCTIVE. Every account, log and support request is deleted. This is for
development and for resetting a test deployment, not for a database with real
user data — that would need a proper migration tool such as Alembic.

Usage, from the backend/ directory:

    python ml/reset_db.py              # prompts for confirmation
    python ml/reset_db.py --yes        # no prompt, for non-interactive shells
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import models  # noqa: E402
from app.database import engine  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Drop and recreate all tables.")
    parser.add_argument(
        "--yes", action="store_true", help="Skip the confirmation prompt"
    )
    args = parser.parse_args()

    # Show which database is about to be wiped, with the password stripped —
    # confusing production for development here would be expensive.
    url = str(engine.url)
    if engine.url.password:
        url = url.replace(engine.url.password, "***")

    print(f"Target database: {url}")

    if not args.yes:
        print("\nThis will DELETE every table and all data in it.")
        answer = input("Type 'reset' to continue: ").strip()
        if answer != "reset":
            print("Cancelled. Nothing was changed.")
            return

    print("Dropping tables...")
    models.Base.metadata.drop_all(bind=engine)

    print("Creating tables...")
    models.Base.metadata.create_all(bind=engine)

    tables = ", ".join(sorted(models.Base.metadata.tables))
    print(f"\nDone. Tables now present: {tables}")
    print("\nNext: python ml/seed_foods.py")
    print("      python ml/create_admin.py --email ... --password ... --role platform_manager")


if __name__ == "__main__":
    main()

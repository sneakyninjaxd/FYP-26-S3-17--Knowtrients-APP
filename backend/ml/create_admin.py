"""
Creates a staff account (Account Administrator or Platform Administrator).

Staff accounts cannot be created through the public API — the admin website's
signup page must not be able to mint administrators, or anyone who finds the
URL becomes one. This script is the only way in, and it requires shell access
to the server or database.

Usage, from the backend/ directory:

    python ml/create_admin.py --email a@b.com --password secret123 \
        --first Ada --last Lovelace --role platform_administrator

    python ml/create_admin.py --list

To create an account on the live database, pass its external URL rather than
editing .env — it applies to this run only:

    python ml/create_admin.py --email ... --password ... --role platform_administrator \
        --database-url "postgresql://..."

Roles: account_administrator, platform_administrator
(the earlier names user_admin and platform_manager are still accepted)
"""

import argparse
import os
import sys

# Must take effect before the database module is imported, because the
# engine is created at import time.
if "--database-url" in sys.argv:
    _i = sys.argv.index("--database-url")
    if _i + 1 < len(sys.argv):
        os.environ["DATABASE_URL"] = sys.argv[_i + 1]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import auth, models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.routers.auth_routes import assign_display_id  # noqa: E402


def create(email: str, password: str, first: str, last: str, role: str) -> None:
    role = models.normalize_role(role)
    if role not in (models.ROLE_ACCOUNT_ADMIN, models.ROLE_PLATFORM_ADMIN):
        raise SystemExit(
            f"role must be {models.ROLE_ACCOUNT_ADMIN} or {models.ROLE_PLATFORM_ADMIN}"
        )
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters long")

    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        email = email.lower().strip()
        existing = db.query(models.User).filter(models.User.email == email).first()

        if existing:
            # Promoting an existing account is the common case when someone
            # signed up through the app first.
            existing.role = role
            assign_display_id(db, existing)
            db.commit()
            print(f"Promoted existing account {email} to {models.ROLE_LABELS[role]} "
                  f"({existing.display_id}).")
            return

        user = models.User(
            email=email,
            first_name=first.strip(),
            last_name=last.strip(),
            hashed_password=auth.hash_password(password),
            role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()
        assign_display_id(db, user)
        db.commit()
        print(f"Created {models.ROLE_LABELS[role]} {email} ({user.display_id}).")
    finally:
        db.close()


def list_staff() -> None:
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        rows = (
            db.query(models.User)
            .filter(models.User.role != models.ROLE_USER)
            .order_by(models.User.role, models.User.id)
            .all()
        )
        if not rows:
            print("No staff accounts exist yet.")
            return
        for user in rows:
            state = "Active" if user.is_active else "Suspended"
            print(
                f"{user.display_id or '-':<6} {user.email:<32} "
                f"{models.ROLE_LABELS[user.role]:<18} {state}"
            )
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or promote a staff account.")
    parser.add_argument("--list", action="store_true", help="List existing staff accounts")
    parser.add_argument("--email")
    parser.add_argument("--password")
    parser.add_argument("--first", default="Admin")
    parser.add_argument("--last", default="User")
    parser.add_argument("--role", default=models.ROLE_ACCOUNT_ADMIN)
    parser.add_argument(
        "--database-url",
        help="Create the account in this database (e.g. the live one) instead of the one in .env",
    )
    args = parser.parse_args()

    if args.list:
        list_staff()
        return

    if not args.email or not args.password:
        parser.error("--email and --password are required (or use --list)")

    create(args.email, args.password, args.first, args.last, args.role)


if __name__ == "__main__":
    main()

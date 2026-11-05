"""
Adds missing columns to existing tables at start-up.

Why this exists
---------------
`Base.metadata.create_all` creates tables that don't exist yet, but never
alters a table that does. So adding a column to a model has, until now,
meant wiping the database — which has happened twice on this project. This
module closes that gap for the one kind of change that is always safe: adding
a new, nullable column.

What it does and doesn't do
---------------------------
It only ever ADDS columns, and only nullable ones with no default. Existing
rows get NULL in the new column, which every model here treats as "not
recorded". It never drops, renames or retypes anything, so it cannot lose
data.

Anything more involved — renaming a column, changing a type, adding a
non-nullable column — still needs a proper migration tool such as Alembic.
This is deliberately not that: it is the smallest thing that removes the
need to reset the database for routine additions.

Adding a column
---------------
1. Add the column to the model, as `nullable=True`.
2. Add an entry to ADDITIVE_COLUMNS below.
3. Deploy. The column is created on the next start-up.

Safe to run repeatedly: a column that already exists is skipped.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

# (table, column, SQL type). Types must be valid in both PostgreSQL and
# SQLite — BOOLEAN, INTEGER, TEXT, VARCHAR, FLOAT and TIMESTAMP all are.
ADDITIVE_COLUMNS: list[tuple[str, str, str]] = [
    ("support_requests", "support_type", "VARCHAR(20)"),
    ("support_requests", "is_persisting", "BOOLEAN"),
    ("support_requests", "last_message_at", "TIMESTAMP"),
]


def ensure_columns(engine: Engine) -> list[str]:
    """
    Creates any listed column that is missing. Returns the ones it added,
    so start-up can log what changed.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    added = []

    with engine.begin() as conn:
        for table, column, sql_type in ADDITIVE_COLUMNS:
            # A table that doesn't exist yet will be created whole by
            # create_all, columns included, so there's nothing to add.
            if table not in existing_tables:
                continue

            present = {c["name"] for c in inspector.get_columns(table)}
            if column in present:
                continue

            # Identifiers come from the hardcoded list above, never from user
            # input, so interpolating them here is safe.
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))
            added.append(f"{table}.{column}")

    return added


# Indexes on columns added above. create_all only builds indexes when it
# creates a table, so an index on an added column has to be made here too.
# CREATE INDEX IF NOT EXISTS is valid in both PostgreSQL and SQLite.
ADDITIVE_INDEXES: list[tuple[str, str, str]] = [
    ("ix_support_requests_support_type", "support_requests", "support_type"),
]


def ensure_indexes(engine: Engine) -> None:
    """Creates any listed index that is missing. Safe to repeat."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for name, table, column in ADDITIVE_INDEXES:
            if table not in tables:
                continue
            conn.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({column})"))


def backfill_support_type(engine: Engine) -> int:
    """
    Fills in `support_type` for requests created before the column existed.

    Only touches rows where it is still empty, so it does nothing after the
    first run. Returns how many rows it updated.

    The category lists come from the model, so this stays in step with them.
    """
    from . import models

    inspector = inspect(engine)
    if "support_requests" not in inspector.get_table_names():
        return 0
    if "support_type" not in {c["name"] for c in inspector.get_columns("support_requests")}:
        return 0

    bug = list(models.BUG_CATEGORIES) + [
        c for c, (kind, _) in models.LEGACY_CATEGORIES.items() if kind == "bug"
    ]

    updated = 0
    with engine.begin() as conn:
        # Bound parameters for the values; the IN list is built from
        # placeholders, never from interpolated strings.
        params = {f"c{i}": c for i, c in enumerate(bug)}
        placeholders = ", ".join(f":{k}" for k in params)

        result = conn.execute(
            text(
                f"UPDATE support_requests SET support_type = 'bug' "
                f"WHERE support_type IS NULL AND category IN ({placeholders})"
            ),
            params,
        )
        updated += result.rowcount or 0

        # Everything else is an account request.
        result = conn.execute(
            text(
                "UPDATE support_requests SET support_type = 'account' "
                "WHERE support_type IS NULL"
            )
        )
        updated += result.rowcount or 0

    return updated


def migrate_role_names(engine: Engine) -> int:
    """
    Renames roles stored under an earlier name to the current one —
    user_admin to account_administrator, platform_manager to
    platform_administrator.

    Only rows still holding an old name are touched, so it does nothing after
    the first run. Returns how many accounts were renamed.
    """
    from . import models

    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return 0

    renamed = 0
    with engine.begin() as conn:
        for old, new in models.LEGACY_ROLES.items():
            result = conn.execute(
                text("UPDATE users SET role = :new WHERE role = :old"),
                {"new": new, "old": old},
            )
            renamed += result.rowcount or 0
    return renamed

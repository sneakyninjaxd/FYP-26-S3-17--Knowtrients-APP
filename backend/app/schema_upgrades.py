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

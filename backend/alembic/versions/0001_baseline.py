"""Baseline: таблицы, колонки и индексы текущей схемы.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-11

Миграция идемпотентна: на существующей базе создаёт только недостающие
таблицы/колонки/индексы и не теряет данные.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = (
    """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        settings JSON
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS todos (
        id TEXT,
        text TEXT,
        completed BOOLEAN DEFAULT FALSE,
        deleted BOOLEAN DEFAULT FALSE,
        updated_at INTEGER DEFAULT 0,
        type TEXT DEFAULT 'todo',
        progress_now TEXT DEFAULT '0',
        progress_end TEXT DEFAULT '1',
        user_id INTEGER,
        contribution INTEGER DEFAULT 0,
        days TEXT DEFAULT '1111111',
        PRIMARY KEY (id, user_id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS daily_history (
        user_id INTEGER,
        date TEXT,
        mood INTEGER,
        daily_progress REAL,
        pos_points INTEGER,
        neg_points INTEGER,
        habits_detail TEXT,
        updated_at INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, date),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS deleted_todos (
        id TEXT,
        user_id INTEGER,
        deleted_at INTEGER,
        PRIMARY KEY (id, user_id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """,
)

# Пары (таблица, колонка, определение) для старых баз.
COLUMNS = (
    ("todos", "contribution", "INTEGER DEFAULT 0"),
    ("daily_history", "habits_detail", "TEXT"),
    ("todos", "days", "TEXT DEFAULT '1111111'"),
    ("daily_history", "updated_at", "INTEGER DEFAULT 0"),
)

INDEXES = (
    "ix_todos_user_id",
    "ix_daily_history_user_date",
    "ix_deleted_todos_user_id",
)


def _column_names(table: str) -> set[str]:
    rows = op.get_bind().exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
    return {row[1] for row in rows}


def upgrade() -> None:
    for statement in TABLES:
        op.execute(statement)

    for table, column, definition in COLUMNS:
        if column not in _column_names(table):
            op.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    op.execute("CREATE INDEX IF NOT EXISTS ix_todos_user_id ON todos(user_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_daily_history_user_date "
        "ON daily_history(user_id, date)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_deleted_todos_user_id "
        "ON deleted_todos(user_id)"
    )


def downgrade() -> None:
    # Таблицы не удаляем, чтобы не потерять данные пользователей.
    for index in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {index}")

"""Тесты подключения, миграций и транзакций SQLite."""

import sqlite3

import pytest

from app.database import Database


async def test_schema_creates_indexes(db):
    rows = await db.fetch_all(
        "SELECT name FROM sqlite_master WHERE type = 'index'"
    )
    names = {row["name"] for row in rows}

    assert "ix_todos_user_id" in names
    assert "ix_daily_history_user_date" in names
    assert "ix_deleted_todos_user_id" in names


async def test_alembic_version_is_recorded(db):
    row = await db.fetch_one("SELECT version_num FROM alembic_version")

    assert row["version_num"] == "0001_baseline"


async def test_busy_timeout_is_set(db):
    row = await db.fetch_one("PRAGMA busy_timeout")

    assert row[0] == 5000


async def test_transaction_rolls_back(db, make_user):
    user_id = await make_user("alice")

    with pytest.raises(RuntimeError):
        async with db.transaction():
            await db.execute(
                "UPDATE users SET username = ? WHERE id = ?",
                ("bob", user_id),
            )
            raise RuntimeError("boom")

    row = await db.fetch_one(
        "SELECT username FROM users WHERE id = ?", (user_id,)
    )
    assert row["username"] == "alice"


async def test_transaction_commits(db, make_user):
    user_id = await make_user("alice")

    async with db.transaction():
        await db.execute(
            "UPDATE users SET username = ? WHERE id = ?", ("bob", user_id)
        )

    row = await db.fetch_one(
        "SELECT username FROM users WHERE id = ?", (user_id,)
    )
    assert row["username"] == "bob"


async def test_legacy_database_is_migrated(tmp_path):
    path = tmp_path / "legacy.db"
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            settings JSON
        );
        CREATE TABLE todos (
            id TEXT,
            text TEXT,
            completed BOOLEAN DEFAULT FALSE,
            deleted BOOLEAN DEFAULT FALSE,
            updated_at INTEGER DEFAULT 0,
            type TEXT DEFAULT 'todo',
            progress_now TEXT DEFAULT '0',
            progress_end TEXT DEFAULT '1',
            user_id INTEGER,
            PRIMARY KEY (id, user_id)
        );
        CREATE TABLE daily_history (
            user_id INTEGER,
            date TEXT,
            mood INTEGER,
            daily_progress REAL,
            pos_points INTEGER,
            neg_points INTEGER,
            PRIMARY KEY (user_id, date)
        );
        CREATE TABLE deleted_todos (
            id TEXT,
            user_id INTEGER,
            deleted_at INTEGER,
            PRIMARY KEY (id, user_id)
        );
        INSERT INTO users (username, password_hash, settings)
        VALUES ('alice', 'hash', '{}');
        INSERT INTO todos (id, text, user_id) VALUES ('t1', 'legacy', 1);
        """
    )
    connection.commit()
    connection.close()

    database = Database(str(path))
    await database.connect()
    try:
        await database.init_schema()

        todo_columns = {
            row["name"]
            for row in await database.fetch_all("PRAGMA table_info(todos)")
        }
        history_columns = {
            row["name"]
            for row in await database.fetch_all(
                "PRAGMA table_info(daily_history)"
            )
        }
        todo = await database.fetch_one("SELECT text FROM todos WHERE id = 't1'")
        version = await database.fetch_one(
            "SELECT version_num FROM alembic_version"
        )

        assert {"contribution", "days"} <= todo_columns
        assert {"habits_detail", "updated_at"} <= history_columns
        assert todo["text"] == "legacy"
        assert version["version_num"] == "0001_baseline"
    finally:
        await database.close()

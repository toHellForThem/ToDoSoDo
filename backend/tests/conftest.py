"""Общие фикстуры тестов бэкенда."""

import os

import pytest_asyncio

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-" + "x" * 64)
os.environ.setdefault("LOG_LEVEL", "WARNING")

from app.database import Database  # noqa: E402
from app.services import Services, build_services  # noqa: E402


@pytest_asyncio.fixture
async def db(tmp_path):
    """Подключение к временной SQLite с инициализированной схемой."""
    database = Database(str(tmp_path / "tasks.db"))
    await database.connect()
    await database.init_schema()
    try:
        yield database
    finally:
        await database.close()


@pytest_asyncio.fixture
async def services(db) -> Services:
    """Сервисы, собранные поверх временной базы."""
    return build_services(db)


@pytest_asyncio.fixture
async def make_user(db):
    """Фабрика пользователей: возвращает ``id`` созданной записи."""

    async def _make(username: str = "alice", password_hash: str = "hash") -> int:
        await db.execute(
            "INSERT INTO users (username, password_hash, settings) VALUES (?, ?, ?)",
            (username, password_hash, "{}"),
        )
        row = await db.fetch_one(
            "SELECT id FROM users WHERE username = ?", (username,)
        )
        return row["id"]

    return _make

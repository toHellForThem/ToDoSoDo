"""Работа с SQLite: подключение, схема и запросы."""

import logging
import sqlite3
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Sequence

import aiosqlite

logger = logging.getLogger(__name__)

SCHEMA_STATEMENTS: tuple[str, ...] = (
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

MIGRATION_STATEMENTS: tuple[str, ...] = (
    "ALTER TABLE todos ADD COLUMN contribution INTEGER DEFAULT 0",
    "ALTER TABLE daily_history ADD COLUMN habits_detail TEXT",
    "ALTER TABLE todos ADD COLUMN days TEXT DEFAULT '1111111'",
    "ALTER TABLE daily_history ADD COLUMN updated_at INTEGER DEFAULT 0",
)


class Database:
    """Обёртка над aiosqlite с явным жизненным циклом подключения."""

    def __init__(self, path: str, timeout: float = 10) -> None:
        self._path = path
        self._timeout = timeout
        self._conn: aiosqlite.Connection | None = None

    @property
    def connection(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("База данных не подключена: вызовите connect()")
        return self._conn

    async def connect(self) -> None:
        if self._conn is not None:
            return
        self._conn = await aiosqlite.connect(self._path, timeout=self._timeout)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute("PRAGMA journal_mode=WAL;")
        logger.info("Подключение к базе данных установлено: %s", self._path)

    async def close(self) -> None:
        if self._conn is None:
            return
        await self._conn.close()
        self._conn = None
        logger.info("Подключение к базе данных закрыто")

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[aiosqlite.Connection]:
        """Контекстный менеджер для ручной работы с соединением."""
        yield self.connection

    async def init_schema(self) -> None:
        conn = self.connection
        try:
            for statement in SCHEMA_STATEMENTS:
                await conn.execute(statement)
            for statement in MIGRATION_STATEMENTS:
                try:
                    await conn.execute(statement)
                except sqlite3.OperationalError:
                    logger.debug("Миграция уже применена: %s", statement)
            await conn.commit()
        except Exception:
            logger.exception("Ошибка инициализации схемы базы данных")
            raise

    async def execute(self, query: str, params: Sequence[Any] = ()) -> None:
        try:
            await self.connection.execute(query, params)
            await self.connection.commit()
        except Exception:
            logger.exception("Ошибка выполнения запроса к базе данных")
            raise

    async def fetch_all(self, query: str, params: Sequence[Any] = ()) -> list[aiosqlite.Row]:
        try:
            async with self.connection.execute(query, params) as cursor:
                return list(await cursor.fetchall())
        except Exception:
            logger.exception("Ошибка чтения из базы данных")
            raise

    async def fetch_one(self, query: str, params: Sequence[Any] = ()) -> aiosqlite.Row | None:
        rows = await self.fetch_all(query, params)
        return rows[0] if rows else None

"""Работа с SQLite: подключение, миграции и запросы."""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator, Sequence

import aiosqlite

logger = logging.getLogger(__name__)


class Database:
    """Обёртка над aiosqlite с явным жизненным циклом подключения."""

    def __init__(self, path: str, timeout: float = 10) -> None:
        self._path = path
        self._timeout = timeout
        self._conn: aiosqlite.Connection | None = None
        self._transaction_depth = 0

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
        await self._conn.execute("PRAGMA busy_timeout = 5000;")
        logger.info("Подключение к базе данных установлено: %s", self._path)

    async def close(self) -> None:
        if self._conn is None:
            return
        await self._conn.close()
        self._conn = None
        logger.info("Подключение к базе данных закрыто")

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[aiosqlite.Connection]:
        """Единая транзакция: коммит на выходе, откат при исключении."""
        conn = self.connection
        self._transaction_depth += 1
        try:
            yield conn
        except Exception:
            self._transaction_depth -= 1
            if self._transaction_depth == 0:
                await conn.rollback()
            raise
        else:
            self._transaction_depth -= 1
            if self._transaction_depth == 0:
                await conn.commit()

    async def init_schema(self) -> None:
        """Применяет Alembic-миграции к базе."""
        try:
            await asyncio.to_thread(self._run_migrations)
        except Exception:
            logger.exception("Ошибка инициализации схемы базы данных")
            raise

    def _run_migrations(self) -> None:
        from alembic.config import Config

        from alembic import command

        base_dir = Path(__file__).resolve().parent.parent
        config = Config(str(base_dir / "alembic.ini"))
        config.attributes["configure_logger"] = False
        config.set_main_option("script_location", str(base_dir / "alembic"))
        config.set_main_option("sqlalchemy.url", f"sqlite:///{self._path}")
        command.upgrade(config, "head")
        logger.info("Миграции базы данных применены")

    async def execute(self, query: str, params: Sequence[Any] = ()) -> int:
        """Выполняет запрос и возвращает число затронутых строк.

        Внутри ``transaction()`` коммит не делается — он происходит на
        выходе из транзакции.
        """
        try:
            cursor = await self.connection.execute(query, params)
            rowcount = cursor.rowcount
            if self._transaction_depth == 0:
                await self.connection.commit()
            return rowcount
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

"""Базовый репозиторий: общая зависимость от слоя БД."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

import aiosqlite

from app.database import Database


class BaseRepository:
    """Хранит ссылку на подключение к базе данных."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[aiosqlite.Connection]:
        """Открывает общую транзакцию для нескольких операций."""
        async with self._db.transaction() as connection:
            yield connection

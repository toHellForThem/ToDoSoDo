"""Репозиторий пользователей."""

import aiosqlite

from app.rep.base import BaseRepository


class UsersRepository(BaseRepository):
    """Доступ к таблице ``users``."""

    async def get_by_username(self, username: str) -> aiosqlite.Row | None:
        """Ищет пользователя по нормализованному (lowercase) логину."""
        if not isinstance(username, str):
            return None
        return await self._db.fetch_one(
            "SELECT * FROM users WHERE username = ?", (username.lower(),)
        )

    async def get_by_id(self, user_id: int) -> aiosqlite.Row | None:
        return await self._db.fetch_one(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        )

    async def create(
        self, username: str, password_hash: str, settings_json: str
    ) -> None:
        await self._db.execute(
            "INSERT INTO users (username, password_hash, settings) VALUES (?, ?, ?)",
            (username, password_hash, settings_json),
        )

    async def update_settings(self, user_id: int, settings_json: str) -> None:
        await self._db.execute(
            "UPDATE users SET settings = ? WHERE id = ?",
            (settings_json, user_id),
        )

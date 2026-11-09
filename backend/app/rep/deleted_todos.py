"""Репозиторий надгробий удалённых задач."""

from app.rep.base import BaseRepository


class DeletedTodosRepository(BaseRepository):
    """Доступ к таблице ``deleted_todos``."""

    async def exists(self, user_id: int, todo_id: str) -> bool:
        row = await self._db.fetch_one(
            "SELECT 1 FROM deleted_todos WHERE user_id = ? AND id = ? LIMIT 1",
            (user_id, todo_id),
        )
        return row is not None

    async def add(self, todo_id: str, user_id: int, deleted_at: int) -> None:
        await self._db.execute(
            "INSERT OR IGNORE INTO deleted_todos (id, user_id, deleted_at) VALUES (?, ?, ?)",
            (todo_id, user_id, deleted_at),
        )

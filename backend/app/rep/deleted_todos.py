"""Репозиторий надгробий удалённых задач."""

from app.rep.base import BaseRepository


class DeletedTodosRepository(BaseRepository):
    """Доступ к таблице ``deleted_todos``."""

    async def exists(
        self,
        user_id: int,
        todo_id: str,
        min_deleted_at: int | None = None,
    ) -> bool:
        """Проверяет tombstone; ``min_deleted_at`` отсекает просроченные."""
        query = "SELECT 1 FROM deleted_todos WHERE user_id = ? AND id = ?"
        params: list[object] = [user_id, todo_id]
        if min_deleted_at is not None:
            query += " AND deleted_at >= ?"
            params.append(min_deleted_at)
        query += " LIMIT 1"
        row = await self._db.fetch_one(query, tuple(params))
        return row is not None

    async def add(self, todo_id: str, user_id: int, deleted_at: int) -> None:
        await self._db.execute(
            "INSERT OR IGNORE INTO deleted_todos (id, user_id, deleted_at) VALUES (?, ?, ?)",
            (todo_id, user_id, deleted_at),
        )

    async def delete_older_than(self, cutoff: int) -> int:
        """Удаляет tombstones старше ``cutoff`` и возвращает их число."""
        return await self._db.execute(
            "DELETE FROM deleted_todos WHERE deleted_at < ?", (cutoff,)
        )

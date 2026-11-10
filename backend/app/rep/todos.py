"""Репозиторий задач."""

import aiosqlite

from app.rep.base import BaseRepository
from app.schemas import Todo


class TodosRepository(BaseRepository):
    """Доступ к таблице ``todos``."""

    async def list_by_user(self, user_id: int) -> list[Todo]:
        rows = await self._db.fetch_all(
            "SELECT * FROM todos WHERE user_id = ?", (user_id,)
        )
        return [self._to_model(row) for row in rows]

    async def get_updated_at(self, todo_id: str, user_id: int) -> int | None:
        row = await self._db.fetch_one(
            "SELECT updated_at FROM todos WHERE id = ? AND user_id = ?",
            (todo_id, user_id),
        )
        return row["updated_at"] if row else None

    async def upsert(self, todo: Todo, user_id: int) -> None:
        await self._db.execute(
            """
            INSERT OR REPLACE INTO todos
                (id, text, completed, deleted, updated_at, type,
                 progress_now, progress_end, user_id, contribution, days)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                todo.id,
                todo.text,
                todo.completed,
                todo.deleted,
                todo.updatedAt,
                todo.type,
                str(todo.progressNow),
                str(todo.progressEnd),
                user_id,
                todo.contribution,
                todo.days,
            ),
        )

    async def delete(self, todo_id: str, user_id: int) -> None:
        await self._db.execute(
            "DELETE FROM todos WHERE id = ? AND user_id = ?", (todo_id, user_id)
        )

    async def reset_by_type(self, user_id: int, todo_type: str, updated_at: int) -> None:
        """Идемпотентно сбрасывает прогресс задач типа ``todo_type``.

        Сбрасываются только неудалённые задачи, которые не обновлялись
        после ``updated_at``.  Повторный вызов с той же меткой ничего не
        меняет, поэтому несколько устройств могут безопасно подтверждать
        один и тот же сброс.
        """
        await self._db.execute(
            """
            UPDATE todos
            SET progress_now = 0, completed = ?, updated_at = ?
            WHERE user_id = ? AND type = ? AND deleted = 0 AND updated_at < ?
            """,
            (False, updated_at, user_id, todo_type, updated_at),
        )

    @staticmethod
    def _to_model(row: aiosqlite.Row) -> Todo:
        keys = row.keys()
        # ``model_construct`` не валидирует уже сохранённые строки: старые
        # записи с устаревшими полями не должны ломать чтение списка задач.
        return Todo.model_construct(
            id=row["id"],
            text=row["text"],
            completed=bool(row["completed"]),
            deleted=bool(row["deleted"]),
            updatedAt=int(row["updated_at"]),
            type=row["type"],
            progressNow=row["progress_now"],
            progressEnd=row["progress_end"],
            contribution=row["contribution"] if "contribution" in keys else 0,
            days=row["days"] if "days" in keys else "1111111",
        )

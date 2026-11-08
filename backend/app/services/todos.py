"""Сервис задач: синхронизация, удаление и сброс."""

import datetime
import logging
from dataclasses import dataclass
from datetime import timezone
from typing import Any

from app.rep import DeletedTodosRepository, TodosRepository
from app.schemas import Todo

logger = logging.getLogger(__name__)


@dataclass
class SyncOutcome:
    """Результат синхронизации одной задачи."""

    updated: bool = False
    deleted: bool = False


class TodoService:
    """Бизнес-логика задач с разрешением конфликтов по ``updatedAt``."""

    def __init__(
        self, todos: TodosRepository, deleted: DeletedTodosRepository
    ) -> None:
        self._todos = todos
        self._deleted = deleted

    async def list_todos(self, user_id: int) -> list[dict[str, Any]]:
        return [todo.model_dump() for todo in await self._todos.list_by_user(user_id)]

    async def sync(self, user_id: int, data: dict[str, Any]) -> SyncOutcome:
        todo_id = data["id"]
        if await self._deleted.exists(user_id, todo_id):
            return SyncOutcome(deleted=True)

        client_updated_at = data.get("updatedAt", 0)
        server_updated_at = await self._todos.get_updated_at(todo_id, user_id)
        if server_updated_at is None or client_updated_at > server_updated_at:
            await self._todos.upsert(Todo(**data), user_id)
            logger.debug("Обновлено: %s (клиентская версия новее)", data.get("text"))
            return SyncOutcome(updated=True)

        logger.debug("На сервере данные новее для: %s", data.get("text"))
        return SyncOutcome()

    async def delete(self, user_id: int, todo_id: str) -> None:
        now = int(datetime.datetime.now(timezone.utc).timestamp() * 1000)
        await self._deleted.add(todo_id, user_id, now)
        await self._todos.delete(todo_id, user_id)

    async def reset_by_type(
        self, user_id: int, todo_type: str, update_time: int
    ) -> None:
        await self._todos.reset_by_type(user_id, todo_type, update_time)
        logger.info("Пользователь %s обновил задачи (type=%s)", user_id, todo_type)

    async def bulk_sync(
        self, user_id: int, client_todos: list[dict[str, Any]]
    ) -> list[tuple[dict[str, Any], SyncOutcome]]:
        return [(todo, await self.sync(user_id, todo)) for todo in client_todos]

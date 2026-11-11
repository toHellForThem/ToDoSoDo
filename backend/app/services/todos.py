"""Сервис задач: синхронизация, удаление и сброс."""

import datetime
import logging
from dataclasses import dataclass
from datetime import timezone
from typing import Any

from app.rep import DeletedTodosRepository, TodosRepository
from app.schemas import Todo, TodoType, validate_todo_id
from app.services.errors import ValidationError, validate_payload

logger = logging.getLogger(__name__)


@dataclass
class SyncOutcome:
    """Результат синхронизации одной задачи.

    ``todo`` — версия клиента, ``server_todo`` — актуальная серверная версия
    при конфликте.  ``status`` используется для ``server:ack``.
    """

    updated: bool = False
    deleted: bool = False
    todo: dict[str, Any] | None = None
    server_todo: dict[str, Any] | None = None

    @property
    def status(self) -> str:
        if self.deleted:
            return "deleted"
        if self.updated:
            return "applied"
        return "conflict"


class TodoService:
    """Бизнес-логика задач с разрешением конфликтов по ``updatedAt``."""

    def __init__(
        self, todos: TodosRepository, deleted: DeletedTodosRepository
    ) -> None:
        self._todos = todos
        self._deleted = deleted

    async def list_todos(self, user_id: int) -> list[dict[str, Any]]:
        return [todo.model_dump() for todo in await self._todos.list_by_user(user_id)]

    async def sync(self, user_id: int, data: Any) -> SyncOutcome:
        todo = validate_payload(Todo, data, "Некорректная задача")
        return await self._sync_model(user_id, todo)

    async def delete(self, user_id: int, todo_id: Any) -> str:
        """Удаляет задачу и возвращает нормализованный идентификатор."""
        try:
            normalized_id = validate_todo_id(todo_id)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        now = int(datetime.datetime.now(timezone.utc).timestamp() * 1000)
        await self._deleted.add(normalized_id, user_id, now)
        await self._todos.delete(normalized_id, user_id)
        return normalized_id

    async def reset_by_type(
        self, user_id: int, todo_type: Any, update_time: Any
    ) -> None:
        try:
            normalized_type = TodoType(todo_type).value
        except (TypeError, ValueError) as exc:
            raise ValidationError(
                f"Некорректный тип задачи: {todo_type!r}"
            ) from exc

        if (
            isinstance(update_time, bool)
            or not isinstance(update_time, int)
            or update_time < 0
        ):
            raise ValidationError("Некорректная метка времени обновления")

        await self._todos.reset_by_type(user_id, normalized_type, update_time)
        logger.info("Пользователь %s обновил задачи (type=%s)", user_id, normalized_type)

    async def bulk_sync(
        self, user_id: int, client_todos: Any
    ) -> list[SyncOutcome]:
        todos = self._validate_bulk(client_todos)
        return [await self._sync_model(user_id, todo) for todo in todos]

    async def _sync_model(self, user_id: int, todo: Todo) -> SyncOutcome:
        payload = todo.model_dump()
        if await self._deleted.exists(user_id, todo.id):
            return SyncOutcome(deleted=True, todo=payload)

        server_updated_at = await self._todos.get_updated_at(todo.id, user_id)
        if server_updated_at is None or todo.updatedAt > server_updated_at:
            await self._todos.upsert(todo, user_id)
            logger.debug("Обновлено: %s (клиентская версия новее)", todo.text)
            return SyncOutcome(updated=True, todo=payload)

        server_todo = await self._todos.get_by_id(todo.id, user_id)
        logger.debug("На сервере данные новее для: %s", todo.text)
        return SyncOutcome(
            todo=payload,
            server_todo=server_todo.model_dump() if server_todo else None,
        )

    @staticmethod
    def _validate_bulk(client_todos: Any) -> list[Todo]:
        if not isinstance(client_todos, list):
            raise ValidationError("Список задач должен быть массивом")
        return [
            validate_payload(Todo, item, "Некорректная задача")
            for item in client_todos
        ]

"""Сервис задач: синхронизация, удаление и сброс."""

import datetime
import logging
from dataclasses import dataclass
from datetime import timezone
from typing import Any

from app.rep import DeletedTodosRepository, TodosRepository
from app.schemas import DeletedTodo, Todo, TodoType, validate_todo_id
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
        self,
        todos: TodosRepository,
        deleted: DeletedTodosRepository,
        tombstone_ttl_days: int = 30,
    ) -> None:
        self._todos = todos
        self._deleted = deleted
        self._tombstone_ttl_days = max(0, tombstone_ttl_days)

    async def list_todos(self, user_id: int) -> list[dict[str, Any]]:
        return [todo.model_dump() for todo in await self._todos.list_by_user(user_id)]

    async def sync(self, user_id: int, data: Any) -> SyncOutcome:
        todo = validate_payload(Todo, data, "Некорректная задача")
        return await self._sync_model(user_id, todo)

    async def delete(
        self, user_id: int, todo_id: Any, deleted_at: int | None = None
    ) -> str:
        """Удаляет задачу и возвращает нормализованный идентификатор.

        ``deleted_at`` позволяет сохранить время офлайн-удаления клиента.
        """
        try:
            normalized_id = validate_todo_id(todo_id)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        if deleted_at is None:
            deleted_at = int(
                datetime.datetime.now(timezone.utc).timestamp() * 1000
            )
        elif (
            isinstance(deleted_at, bool)
            or not isinstance(deleted_at, int)
            or deleted_at < 0
        ):
            raise ValidationError("Некорректная метка удаления")

        await self._deleted.add(normalized_id, user_id, deleted_at)
        await self._todos.delete(normalized_id, user_id)
        return normalized_id

    async def bulk_delete(self, user_id: int, items: Any) -> list[str]:
        """Применяет tombstones, накопленные клиентом офлайн.

        Сначала валидируется весь батч, и только потом выполняются
        удаления: невалидный элемент не оставляет частичных изменений.
        """
        if not isinstance(items, list):
            raise ValidationError("Список удалённых задач должен быть массивом")

        models = [
            validate_payload(DeletedTodo, item, "Некорректная запись удаления")
            for item in items
        ]
        deleted_ids: list[str] = []
        for model in models:
            deleted_ids.append(
                await self.delete(user_id, model.id, model.deletedAt)
            )
        return deleted_ids

    async def cleanup_tombstones(self) -> int:
        """Удаляет tombstones старше TTL и возвращает их число."""
        removed = await self._deleted.delete_older_than(self._tombstone_cutoff())
        if removed:
            logger.info("Удалено старых tombstones: %s", removed)
        return removed

    def _tombstone_cutoff(self) -> int:
        ttl_ms = self._tombstone_ttl_days * 24 * 60 * 60 * 1000
        now = int(datetime.datetime.now(timezone.utc).timestamp() * 1000)
        return now - ttl_ms

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
        async with self._todos.transaction():
            return [await self._sync_model(user_id, todo) for todo in todos]

    async def _sync_model(self, user_id: int, todo: Todo) -> SyncOutcome:
        payload = todo.model_dump()
        if await self._deleted.exists(
            user_id, todo.id, self._tombstone_cutoff()
        ):
            return SyncOutcome(deleted=True, todo=payload)

        server_todo = await self._todos.get_by_id(todo.id, user_id)
        if server_todo is None or todo.updatedAt > server_todo.updatedAt:
            await self._todos.upsert(todo, user_id)
            logger.debug("Обновлено: %s (клиентская версия новее)", todo.text)
            return SyncOutcome(updated=True, todo=payload)

        logger.debug("На сервере данные новее для: %s", todo.text)
        return SyncOutcome(todo=payload, server_todo=server_todo.model_dump())

    @staticmethod
    def _validate_bulk(client_todos: Any) -> list[Todo]:
        if not isinstance(client_todos, list):
            raise ValidationError("Список задач должен быть массивом")
        return [
            validate_payload(Todo, item, "Некорректная задача")
            for item in client_todos
        ]

"""Сервис ежедневной истории."""

import logging
from typing import Any

from app.rep import DailyHistoryRepository
from app.schemas import DailyHistory, validate_month
from app.services.errors import ValidationError, validate_payload

logger = logging.getLogger(__name__)

# Поля, которые определяют содержимое записи. `updatedAt` — метка времени,
# а не данные: при одинаковом содержимом конфликта нет.
CONTENT_FIELDS = (
    "mood",
    "daily_progress",
    "pos_points",
    "neg_points",
    "habits_detail",
)

SYNC_APPLIED = "applied"
SYNC_CONFLICT = "conflict"
SYNC_NOOP = "noop"


def _same_content(client: dict[str, Any], server: dict[str, Any]) -> bool:
    """Сравнивает данные записи, игнорируя ``updatedAt``."""
    return all(client.get(field) == server.get(field) for field in CONTENT_FIELDS)


class DailyHistoryService:
    """Бизнес-логика истории с разрешением конфликтов по ``updatedAt``."""

    def __init__(self, history: DailyHistoryRepository) -> None:
        self._history = history

    async def get_month(self, user_id: int, month: Any) -> list[dict[str, Any]]:
        try:
            normalized_month = validate_month(month)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        return await self._history.list_by_month(user_id, normalized_month)

    async def sync(self, user_id: int, entry: Any) -> tuple[dict[str, Any], str]:
        """Возвращает каноничную запись и статус: applied/conflict/noop."""
        model = validate_payload(DailyHistory, entry, "Некорректная запись истории")
        return await self._sync_model(user_id, model)

    async def bulk_sync(
        self, user_id: int, entries: Any
    ) -> list[tuple[dict[str, Any], str]]:
        models = self._validate_bulk(entries)
        async with self._history.transaction():
            return [await self._sync_model(user_id, model) for model in models]

    async def _sync_model(
        self, user_id: int, entry: DailyHistory
    ) -> tuple[dict[str, Any], str]:
        payload = entry.model_dump()
        server_entry = await self._history.get_by_date(user_id, entry.date)
        if server_entry is None or entry.updatedAt > server_entry["updatedAt"]:
            await self._history.upsert(payload, user_id)
            return payload, SYNC_APPLIED

        if _same_content(payload, server_entry):
            # Эхо удалённого изменения: содержимое совпадает, конфликта нет.
            return server_entry, SYNC_NOOP

        return server_entry, SYNC_CONFLICT

    @staticmethod
    def _validate_bulk(entries: Any) -> list[DailyHistory]:
        if not isinstance(entries, list):
            raise ValidationError("Список истории должен быть массивом")
        return [
            validate_payload(DailyHistory, item, "Некорректная запись истории")
            for item in entries
        ]

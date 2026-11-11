"""Сервис ежедневной истории."""

import logging
from typing import Any

from app.rep import DailyHistoryRepository
from app.schemas import DailyHistory, validate_month
from app.services.errors import ValidationError, validate_payload

logger = logging.getLogger(__name__)


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

    async def sync(self, user_id: int, entry: Any) -> tuple[dict[str, Any], bool]:
        """Возвращает каноничную запись и признак победы клиентской версии."""
        model = validate_payload(DailyHistory, entry, "Некорректная запись истории")
        return await self._sync_model(user_id, model)

    async def bulk_sync(
        self, user_id: int, entries: Any
    ) -> list[tuple[dict[str, Any], bool]]:
        models = self._validate_bulk(entries)
        async with self._history.transaction():
            return [await self._sync_model(user_id, model) for model in models]

    async def _sync_model(
        self, user_id: int, entry: DailyHistory
    ) -> tuple[dict[str, Any], bool]:
        payload = entry.model_dump()
        server_updated_at = await self._history.get_updated_at(user_id, entry.date)
        if server_updated_at is None or entry.updatedAt > server_updated_at:
            await self._history.upsert(payload, user_id)
            return payload, True

        server_entry = await self._history.get_by_date(user_id, entry.date)
        return server_entry or payload, False

    @staticmethod
    def _validate_bulk(entries: Any) -> list[DailyHistory]:
        if not isinstance(entries, list):
            raise ValidationError("Список истории должен быть массивом")
        return [
            validate_payload(DailyHistory, item, "Некорректная запись истории")
            for item in entries
        ]

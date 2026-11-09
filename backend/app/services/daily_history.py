"""Сервис ежедневной истории."""

import logging
from typing import Any

from app.rep import DailyHistoryRepository

logger = logging.getLogger(__name__)


class DailyHistoryService:
    """Бизнес-логика истории с разрешением конфликтов по ``updatedAt``."""

    def __init__(self, history: DailyHistoryRepository) -> None:
        self._history = history

    async def get_month(self, user_id: int, month: str) -> list[dict[str, Any]]:
        return await self._history.list_by_month(user_id, month)

    async def sync(self, user_id: int, entry: dict[str, Any]) -> bool:
        """Возвращает ``True``, если запись клиента оказалась новее."""
        date = entry["date"]
        client_updated_at = entry.get("updatedAt", 0)
        server_updated_at = await self._history.get_updated_at(user_id, date)
        if server_updated_at is None or client_updated_at > server_updated_at:
            await self._history.upsert(entry, user_id)
            return True
        return False

    async def bulk_sync(
        self, user_id: int, entries: list[dict[str, Any]]
    ) -> list[tuple[dict[str, Any], bool]]:
        return [(entry, await self.sync(user_id, entry)) for entry in entries]

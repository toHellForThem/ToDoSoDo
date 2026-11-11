"""Сервис пользовательских настроек."""

import logging
from typing import Any

from app.rep import UsersRepository
from app.schemas.settings import (
    default_settings,
    dump_settings,
    normalize_settings,
    parse_settings,
)

logger = logging.getLogger(__name__)


class SettingsService:
    """Бизнес-логика настроек с разрешением конфликтов по ``updatedAt``."""

    def __init__(self, users: UsersRepository) -> None:
        self._users = users

    async def get(self, user_id: int) -> dict[str, Any]:
        """Возвращает актуальные настройки пользователя с дефолтами."""
        user = await self._users.get_by_id(user_id)
        stored = self._stored_settings(user)
        if stored is None:
            return default_settings()
        return normalize_settings(stored)

    async def update(
        self, user_id: int, settings_dict: dict[str, Any]
    ) -> tuple[dict[str, Any], bool]:
        """Возвращает актуальные настройки и признак применения клиентских."""
        client_settings = normalize_settings(settings_dict)
        user = await self._users.get_by_id(user_id)
        stored = self._stored_settings(user)

        if stored is None:
            await self._save(user_id, client_settings)
            logger.info("Пользователь %s инициализировал настройки", user_id)
            return client_settings, True

        current_settings = normalize_settings(stored)
        if client_settings["updatedAt"] > current_settings["updatedAt"]:
            await self._save(user_id, client_settings)
            logger.info("Пользователь %s обновил настройки", user_id)
            return client_settings, True

        if stored != current_settings:
            await self._save(user_id, current_settings)
            logger.info(
                "Настройки пользователя %s приведены к полному контракту", user_id
            )

        logger.debug("На сервере настройки новее для пользователя %s", user_id)
        return current_settings, False

    @staticmethod
    def _stored_settings(user: Any) -> dict[str, Any] | None:
        """Разбирает сохранённые настройки, считая пустые значения отсутствием."""
        if user is None:
            return None
        stored = parse_settings(user["settings"])
        return stored or None

    async def _save(self, user_id: int, settings_dict: dict[str, Any]) -> None:
        await self._users.update_settings(user_id, dump_settings(settings_dict))

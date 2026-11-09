"""Сервис пользовательских настроек."""

import json
import logging
from typing import Any

from app.rep import UsersRepository

logger = logging.getLogger(__name__)


class SettingsService:
    """Бизнес-логика настроек с разрешением конфликтов по ``updatedAt``."""

    def __init__(self, users: UsersRepository) -> None:
        self._users = users

    async def update(
        self, user_id: int, settings_dict: dict[str, Any]
    ) -> tuple[dict[str, Any], bool]:
        """Возвращает актуальные настройки и признак применения клиентских."""
        user = await self._users.get_by_id(user_id)
        if user and user["settings"]:
            current_settings = json.loads(user["settings"])
            current_updated_at = current_settings.get("updatedAt", 0)
            client_updated_at = settings_dict.get("updatedAt", 0)

            if client_updated_at > current_updated_at:
                await self._users.update_settings(user_id, json.dumps(settings_dict))
                logger.info("Пользователь %s обновил настройки", user_id)
                return settings_dict, True

            logger.debug("На сервере настройки новее для пользователя %s", user_id)
            return current_settings, False

        await self._users.update_settings(user_id, json.dumps(settings_dict))
        logger.info("Пользователь %s инициализировал настройки", user_id)
        return settings_dict, True

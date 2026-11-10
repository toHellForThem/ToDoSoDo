"""Сервис аутентификации: регистрация, вход и работа с JWT."""

import datetime
import logging
from datetime import timezone
from typing import Any

import jwt
from werkzeug.security import check_password_hash, generate_password_hash

from app.config import settings
from app.rep import UsersRepository
from app.schemas.settings import (
    default_settings,
    dump_settings,
    normalize_user_settings,
)
from app.services.errors import AuthError, ConflictError, ValidationError

logger = logging.getLogger(__name__)


class AuthService:
    """Бизнес-логика регистрации и входа пользователей."""

    def __init__(self, users: UsersRepository) -> None:
        self._users = users

    def create_access_token(self, user_id: int) -> str:
        payload = {
            "user_id": user_id,
            "exp": datetime.datetime.now(timezone.utc)
            + datetime.timedelta(days=settings.jwt_expire_days),
        }
        return jwt.encode(
            payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )

    def decode_token(self, token: str | None) -> tuple[int | None, bool]:
        """Возвращает пару ``(user_id, expired)``."""
        if not token:
            return None, False
        try:
            payload = jwt.decode(
                token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
            )
            return payload.get("user_id"), False
        except jwt.ExpiredSignatureError:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
                options={"verify_exp": False},
            )
            return payload.get("user_id"), True
        except jwt.InvalidTokenError:
            return None, False

    async def register(self, username: str | None, password: str | None) -> None:
        if not username or not password:
            raise ValidationError("Заполните все поля!")

        password_hash = generate_password_hash(password)
        try:
            await self._users.create(
                username, password_hash, dump_settings(default_settings())
            )
        except Exception as exc:
            logger.exception("Ошибка регистрации пользователя %s: %s", username, exc)
            raise ConflictError("Такой логин уже занят") from exc

        logger.info("Пользователь %s успешно зарегистрирован", username)

    async def login(self, username: str, password: str) -> dict[str, Any]:
        user = await self._users.get_by_username(username)
        if not user:
            logger.warning("Попытка входа: пользователь %s не найден", username)
            raise AuthError("Такого пользователя не существует")

        if not check_password_hash(user["password_hash"], password):
            logger.warning("Неверный пароль для пользователя %s", username)
            raise AuthError("Неверный пароль")

        logger.info("Пользователь %s вошёл в систему", user["username"])
        return {
            "user_id": user["id"],
            "username": user["username"],
            "token": self.create_access_token(user["id"]),
            "settings": await self.load_settings(user),
        }

    async def load_settings(self, user: Any) -> dict[str, Any]:
        """Возвращает полный набор настроек, попутно мигрируя старые записи."""
        normalized, changed = normalize_user_settings(user["settings"])
        if changed:
            await self._users.update_settings(user["id"], dump_settings(normalized))
            logger.info(
                "Настройки пользователя %s приведены к полному контракту", user["id"]
            )
        return normalized

    async def get_user(self, user_id: int):
        return await self._users.get_by_id(user_id)

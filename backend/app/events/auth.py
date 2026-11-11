"""Socket-события аутентификации: регистрация, вход, подключение и выход."""

import logging
from typing import Any

import socketio

from app.config import settings
from app.events.deps import authenticated
from app.events.errors import emit_auth_error
from app.events.names import ClientEvent, ServerEvent
from app.events.protocol import parse_request
from app.services import AuthError, ConflictError, Services, ValidationError
from app.services.rate_limit import RateLimiter

logger = logging.getLogger(__name__)


def _rate_key(payload: dict[str, Any]) -> str:
    """Ключ rate limit: нормализованный логин или anonymous."""
    username = payload.get("username")
    if isinstance(username, str) and username.strip():
        return username.strip().lower()
    return "anonymous"


def register(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует хендлеры аутентификации на сервере."""

    login_limiter = RateLimiter(
        settings.auth_rate_limit_attempts,
        settings.auth_rate_limit_window_seconds,
    )
    register_limiter = RateLimiter(
        settings.auth_rate_limit_attempts,
        settings.auth_rate_limit_window_seconds,
    )

    @sio.on(ClientEvent.REGISTER)
    async def handle_register(sid, data):
        request = parse_request(data)
        payload = request.payload if isinstance(request.payload, dict) else {}
        key = _rate_key(payload)
        if not register_limiter.allow(key):
            await emit_auth_error(
                sio,
                sid,
                "Слишком много попыток регистрации, попробуйте позже",
                request.request_id,
            )
            return

        username = payload.get("username")
        try:
            await services.auth.register(username, payload.get("password"))
        except (ValidationError, ConflictError) as exc:
            await emit_auth_error(sio, sid, exc.message, request.request_id)
            return

        register_limiter.reset(key)

        await sio.emit(
            ServerEvent.REGISTER_SUCCESS, {"msg": "Аккаунт создан!"}, room=sid
        )
        await sio.emit(
            ServerEvent.AUTH_MESSAGE,
            {
                "status": "success",
                "message": f"Пользователь {username} успешно зарегистрирован!",
            },
            room=sid,
        )

    @sio.on(ClientEvent.LOGIN)
    async def handle_login(sid, data):
        request = parse_request(data)
        payload = request.payload if isinstance(request.payload, dict) else {}
        key = _rate_key(payload)
        if not login_limiter.allow(key):
            await emit_auth_error(
                sio,
                sid,
                "Слишком много попыток входа, попробуйте позже",
                request.request_id,
            )
            return

        try:
            result = await services.auth.login(
                payload.get("username"), payload.get("password")
            )
        except (AuthError, ValidationError) as exc:
            await emit_auth_error(sio, sid, exc.message, request.request_id)
            return

        login_limiter.reset(key)

        await sio.save_session(sid, {"user_id": result["user_id"]})
        await sio.enter_room(sid, result["user_id"])

        await sio.emit(
            ServerEvent.LOGIN_SUCCESS,
            {
                "username": result["username"],
                "token": result["token"],
                "settings": result["settings"],
            },
            room=sid,
        )
        await sio.emit(
            ServerEvent.AUTH_MESSAGE,
            {"status": "success", "message": "Вход выполнен успешно!"},
            room=sid,
        )

    @sio.on("connect")
    async def handle_connect(sid, environ, auth):
        """Поведение при подключении и переподключении.

        * без токена — локальный режим, сервер молчит;
        * истёкший или некорректный токен — ``server:auth_expired``;
        * валидный токен — сессия, комната и ``server:login_success``,
          после которого клиент повторно синхронизирует состояние.
        """
        logger.info("Клиент подключается: %s", sid)
        token = auth.get("token") if auth else None
        if not token:
            return True

        user_id, expired = services.auth.decode_token(token)

        if expired:
            logger.warning(
                "Сессия пользователя %s истекла, требуется повторный вход", user_id
            )
            await sio.emit(ServerEvent.AUTH_EXPIRED, room=sid)
            return True

        if not user_id:
            logger.warning("Некорректный токен при подключении (sid=%s)", sid)
            await sio.emit(ServerEvent.AUTH_EXPIRED, room=sid)
            return True

        user = await services.auth.get_user(user_id)
        if not user:
            logger.warning("Пользователь с ID %s не найден в базе данных", user_id)
            await sio.emit(ServerEvent.AUTH_EXPIRED, room=sid)
            return True

        await sio.save_session(sid, {"user_id": user["id"]})
        await sio.enter_room(sid, user["id"])

        await sio.emit(
            ServerEvent.LOGIN_SUCCESS,
            {
                "username": user["username"],
                "token": token,
                "settings": await services.auth.load_settings(user),
            },
            room=sid,
        )

        return True

    @sio.on(ClientEvent.LOGOUT)
    @authenticated(sio)
    async def handle_logout(sid, user_id):
        await sio.leave_room(sid, user_id)
        await sio.save_session(sid, {})


__all__ = ["register"]

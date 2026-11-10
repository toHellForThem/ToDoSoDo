"""Socket-события аутентификации: регистрация, вход, подключение и выход."""

import logging

import socketio

from app.events.deps import authenticated
from app.events.errors import emit_auth_error
from app.events.names import ClientEvent, ServerEvent
from app.services import AuthError, ConflictError, Services, ValidationError

logger = logging.getLogger(__name__)


def register(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует хендлеры аутентификации на сервере."""

    @sio.on(ClientEvent.REGISTER)
    async def handle_register(sid, data):
        username = data.get("username")
        try:
            await services.auth.register(username, data.get("password"))
        except (ValidationError, ConflictError) as exc:
            await emit_auth_error(sio, sid, exc.message)
            return

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
        try:
            result = await services.auth.login(data["username"], data["password"])
        except AuthError as exc:
            await emit_auth_error(sio, sid, exc.message)
            return

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
        logger.info("Клиент подключается: %s", sid)
        token = auth.get("token") if auth else None
        user_id, expired = services.auth.decode_token(token)

        if not user_id:
            return True

        if expired:
            logger.warning(
                "Сессия пользователя %s истекла, требуется повторный вход", user_id
            )
            await sio.emit(ServerEvent.AUTH_EXPIRED, room=sid)
            return True

        user = await services.auth.get_user(user_id)
        if not user:
            logger.warning("Пользователь с ID %s не найден в базе данных", user_id)
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

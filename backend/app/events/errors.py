"""Маппинг доменных исключений в socket-события ошибок."""

import functools
import logging
from typing import Any, Awaitable, Callable

import socketio

from app.events.names import ServerEvent
from app.services import ServiceError

logger = logging.getLogger(__name__)

Handler = Callable[..., Awaitable[Any]]


async def emit_auth_error(
    sio: socketio.AsyncServer, sid: str, message: str
) -> None:
    """Отправляет ошибку аутентификации конкретному клиенту."""
    await sio.emit(
        ServerEvent.AUTH_MESSAGE,
        {"status": "error", "message": message},
        room=sid,
    )


async def emit_error(sio: socketio.AsyncServer, sid: str, message: str) -> None:
    """Отправляет общую ошибку конкретному клиенту."""
    await sio.emit(ServerEvent.ERROR, {"message": message}, room=sid)


def handle_service_errors(
    sio: socketio.AsyncServer,
) -> Callable[[Handler], Handler]:
    """Превращает доменные и неожиданные исключения в ``server:error``."""

    def decorator(handler: Handler) -> Handler:
        @functools.wraps(handler)
        async def wrapper(sid: str, *args: Any) -> Any:
            try:
                return await handler(sid, *args)
            except ServiceError as exc:
                logger.warning("Ошибка в %s: %s", handler.__name__, exc.message)
                await emit_error(sio, sid, exc.message)
            except Exception:
                logger.exception("Необработанная ошибка в %s", handler.__name__)
                await emit_error(sio, sid, "Внутренняя ошибка сервера")

        return wrapper

    return decorator


__all__ = ["emit_auth_error", "emit_error", "handle_service_errors"]

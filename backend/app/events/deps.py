"""Общие зависимости socket-хендлеров: сессия и проверка авторизации."""

import functools
import logging
from typing import Any, Awaitable, Callable

import socketio

from app.events.errors import emit_error
from app.events.protocol import extract_request_id

logger = logging.getLogger(__name__)

Handler = Callable[..., Awaitable[Any]]


async def get_user_id(sio: socketio.AsyncServer, sid: str) -> int | None:
    """Возвращает ``user_id`` из сессии или ``None``, если клиент не авторизован."""
    session = await sio.get_session(sid)
    return session.get("user_id")


def authenticated(
    sio: socketio.AsyncServer, event: str | None = None
) -> Callable[[Handler], Handler]:
    """Пропускает вызов только для авторизованных клиентов.

    Обёрнутый хендлер получает ``user_id`` вторым аргументом:
    ``handler(sid, user_id, *args)``.
    """

    def decorator(handler: Handler) -> Handler:
        @functools.wraps(handler)
        async def wrapper(sid: str, *args: Any) -> Any:
            name = event or handler.__name__
            user_id = await get_user_id(sio, sid)
            if not user_id:
                logger.warning(
                    "Событие %s без авторизации (sid=%s)", name, sid
                )
                await emit_error(
                    sio,
                    sid,
                    "Требуется авторизация",
                    "unauthorized",
                    extract_request_id(args),
                )
                return None
            logger.debug("Событие %s: user_id=%s sid=%s", name, user_id, sid)
            return await handler(sid, user_id, *args)

        return wrapper

    return decorator


__all__ = ["authenticated", "get_user_id"]

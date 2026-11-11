"""Маппинг доменных исключений в socket-события ошибок."""

import functools
import logging
from typing import Any, Awaitable, Callable

import socketio

from app.events.names import ServerEvent
from app.events.protocol import AckStatus, emit_ack, extract_request_id
from app.services import ServiceError

logger = logging.getLogger(__name__)

Handler = Callable[..., Awaitable[Any]]


async def emit_auth_error(
    sio: socketio.AsyncServer,
    sid: str,
    message: str,
    request_id: str | None = None,
) -> None:
    """Отправляет ошибку аутентификации конкретному клиенту."""
    payload = {"status": "error", "message": message}
    if request_id is not None:
        payload["request_id"] = request_id
    await sio.emit(ServerEvent.AUTH_MESSAGE, payload, room=sid)


async def emit_error(
    sio: socketio.AsyncServer,
    sid: str,
    message: str,
    code: str = "error",
    request_id: str | None = None,
    event: str | None = None,
) -> None:
    """Отправляет ошибку с кодом и ``request_id`` конкретному клиенту."""
    await sio.emit(
        ServerEvent.ERROR,
        {
            "code": code,
            "message": message,
            "request_id": request_id,
            "event": event,
        },
        room=sid,
    )


def handle_service_errors(
    sio: socketio.AsyncServer,
    event: str | None = None,
    ack: bool = False,
) -> Callable[[Handler], Handler]:
    """Превращает доменные и неожиданные исключения в ``server:error``.

    ``ack=True`` дополнительно отправляет ``server:ack`` со статусом
    ``rejected``.  Включается только для мутирующих событий.
    """

    def decorator(handler: Handler) -> Handler:
        @functools.wraps(handler)
        async def wrapper(sid: str, *args: Any) -> Any:
            request_id = extract_request_id(args)
            try:
                return await handler(sid, *args)
            except ServiceError as exc:
                logger.warning("Ошибка в %s: %s", handler.__name__, exc.message)
                await emit_error(
                    sio, sid, exc.message, exc.code, request_id, event
                )
                if ack and event is not None:
                    await emit_ack(
                        sio, sid, event, request_id, AckStatus.REJECTED
                    )
            except Exception:
                logger.exception("Необработанная ошибка в %s", handler.__name__)
                await emit_error(
                    sio,
                    sid,
                    "Внутренняя ошибка сервера",
                    "internal_error",
                    request_id,
                    event,
                )
                if ack and event is not None:
                    await emit_ack(
                        sio, sid, event, request_id, AckStatus.REJECTED
                    )

        return wrapper

    return decorator


__all__ = ["emit_auth_error", "emit_error", "handle_service_errors"]

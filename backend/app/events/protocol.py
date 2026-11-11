"""Протокол синхронизации: конверт запроса, ack и статусы применения.

Клиент может присылать событие в старом формате (голый payload) или в
конверте ``{"request_id": "...", "payload": ...}``.  ``request_id``
возвращается в ``server:ack`` и ``server:error``, чтобы клиент мог
сопоставить ответ с отправленным изменением.

Статусы ``server:ack``:

* ``applied`` — изменение клиента применено;
* ``conflict`` — на сервере более новая версия, в ``data`` лежит она;
* ``deleted`` — задача удалена (tombstone), повторное создание запрещено;
* ``rejected`` — изменение отклонено (например, некорректный payload);
* ``processed`` — batch обработан, детали в ``data.results``.

Ack отправляется только на мутирующие события. Read-события отвечают
своим обычным событием (``server:all_todos``, ``server:month_history``,
``server:state``).
"""

from dataclasses import dataclass
from typing import Any

import socketio

from app.events.names import ServerEvent


class AckStatus:
    """Статусы явного ответа сервера на клиентское событие."""

    APPLIED = "applied"
    CONFLICT = "conflict"
    DELETED = "deleted"
    REJECTED = "rejected"
    PROCESSED = "processed"


@dataclass(frozen=True)
class Request:
    """Разобранный запрос клиента: необязательный ``request_id`` и payload."""

    request_id: str | None
    payload: Any


def parse_request(data: Any) -> Request:
    """Разбирает конверт ``{request_id, payload}`` или голый payload."""
    if isinstance(data, dict) and "request_id" in data and "payload" in data:
        request_id = data["request_id"]
        return Request(
            request_id=str(request_id) if request_id is not None else None,
            payload=data["payload"],
        )
    return Request(request_id=None, payload=data)


def parse_request_args(args: tuple[Any, ...]) -> Request:
    """Разбирает запрос для событий с несколькими позиционными аргументами."""
    if len(args) == 1:
        return parse_request(args[0])
    return Request(request_id=None, payload=args)


def extract_request_id(args: tuple[Any, ...]) -> str | None:
    """Достаёт ``request_id`` из аргументов хендлера, если он передан."""
    for arg in args:
        if isinstance(arg, dict) and "request_id" in arg:
            value = arg["request_id"]
            return str(value) if value is not None else None
    return None


async def emit_ack(
    sio: socketio.AsyncServer,
    sid: str,
    event: str,
    request_id: str | None,
    status: str,
    data: Any = None,
) -> None:
    """Отправляет явный ответ на клиентское событие."""
    await sio.emit(
        ServerEvent.ACK,
        {
            "request_id": request_id,
            "event": event,
            "status": status,
            "data": data,
        },
        room=sid,
    )


__all__ = [
    "AckStatus",
    "Request",
    "emit_ack",
    "extract_request_id",
    "parse_request",
    "parse_request_args",
]

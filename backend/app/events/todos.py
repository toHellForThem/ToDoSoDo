"""Socket-события задач: чтение, синхронизация, удаление и сброс."""

from typing import Any

import socketio

from app.events.deps import authenticated
from app.events.errors import handle_service_errors
from app.events.names import ClientEvent, ServerEvent
from app.events.protocol import (
    AckStatus,
    emit_ack,
    parse_request,
    parse_request_args,
)
from app.services import Services


def register(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует хендлеры задач на сервере."""

    async def send_todos(sid: str, user_id: int) -> None:
        todos = await services.todos.list_todos(user_id)
        await sio.emit(ServerEvent.ALL_TODOS, todos, room=sid)

    @sio.on(ClientEvent.GET_TODOS)
    @handle_service_errors(sio, ClientEvent.GET_TODOS)
    @authenticated(sio)
    async def handle_get_todos(sid, user_id):
        await send_todos(sid, user_id)

    @sio.on(ClientEvent.SYNC_TODO)
    @handle_service_errors(sio, ClientEvent.SYNC_TODO)
    @authenticated(sio)
    async def handle_sync(sid, user_id, data):
        request = parse_request(data)
        outcome = await services.todos.sync(user_id, request.payload)

        if outcome.deleted:
            await sio.emit(ServerEvent.TODO_DELETED, outcome.todo["id"], room=sid)
            await emit_ack(
                sio,
                sid,
                ClientEvent.SYNC_TODO,
                request.request_id,
                AckStatus.DELETED,
                {"id": outcome.todo["id"]},
            )
            return

        if outcome.updated:
            await sio.emit(
                ServerEvent.TODO_UPDATED, outcome.todo, room=user_id, skip_sid=sid
            )
            await emit_ack(
                sio,
                sid,
                ClientEvent.SYNC_TODO,
                request.request_id,
                AckStatus.APPLIED,
                outcome.todo,
            )
            return

        # Конфликт: отдаём клиенту актуальную серверную версию.
        if outcome.server_todo is not None:
            await sio.emit(ServerEvent.TODO_UPDATED, outcome.server_todo, room=sid)
        await emit_ack(
            sio,
            sid,
            ClientEvent.SYNC_TODO,
            request.request_id,
            AckStatus.CONFLICT,
            outcome.server_todo,
        )

    @sio.on(ClientEvent.DELETE_TODO)
    @handle_service_errors(sio, ClientEvent.DELETE_TODO)
    @authenticated(sio)
    async def handle_delete_todo(sid, user_id, todo_id):
        request = parse_request(todo_id)
        deleted_id = await services.todos.delete(user_id, request.payload)
        await sio.emit(
            ServerEvent.TODO_DELETED, deleted_id, room=user_id, skip_sid=sid
        )
        await emit_ack(
            sio,
            sid,
            ClientEvent.DELETE_TODO,
            request.request_id,
            AckStatus.APPLIED,
            {"id": deleted_id},
        )

    @sio.on(ClientEvent.CONFIRM_RESET)
    @handle_service_errors(sio, ClientEvent.CONFIRM_RESET)
    @authenticated(sio)
    async def handle_reset_todos(sid, user_id, *args):
        request = parse_request_args(args)
        todo_type, update_time = _unpack_reset(request.payload)
        await services.todos.reset_by_type(user_id, todo_type, update_time)
        await send_todos(sid, user_id)
        await emit_ack(
            sio,
            sid,
            ClientEvent.CONFIRM_RESET,
            request.request_id,
            AckStatus.APPLIED,
            {"type": todo_type, "updatedAt": update_time},
        )

    @sio.on(ClientEvent.BULK_SYNC_TODOS)
    @handle_service_errors(sio, ClientEvent.BULK_SYNC_TODOS)
    @authenticated(sio)
    async def handle_bulk_sync_todos(sid, user_id, client_todos):
        request = parse_request(client_todos)
        results = []
        for outcome in await services.todos.bulk_sync(user_id, request.payload):
            if outcome.todo is None:
                continue
            if outcome.deleted:
                await sio.emit(ServerEvent.TODO_DELETED, outcome.todo["id"], room=sid)
            elif outcome.updated:
                await sio.emit(
                    ServerEvent.TODO_UPDATED, outcome.todo, room=user_id, skip_sid=sid
                )
            results.append(
                {
                    "id": outcome.todo["id"],
                    "status": outcome.status,
                    "todo": outcome.server_todo or outcome.todo,
                }
            )

        await send_todos(sid, user_id)
        await emit_ack(
            sio,
            sid,
            ClientEvent.BULK_SYNC_TODOS,
            request.request_id,
            AckStatus.APPLIED,
            {"results": results},
        )


def _unpack_reset(payload: Any) -> tuple[Any, Any]:
    """Поддерживает старый ``(type, time)`` и конверт с объектом."""
    if isinstance(payload, dict):
        return payload.get("type"), payload.get("updatedAt")
    todo_type, update_time = payload
    return todo_type, update_time


__all__ = ["register"]

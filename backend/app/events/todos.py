"""Socket-события задач: чтение, синхронизация, удаление и сброс."""

import socketio

from app.events.deps import authenticated
from app.events.errors import handle_service_errors
from app.events.names import ClientEvent, ServerEvent
from app.services import Services


def register(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует хендлеры задач на сервере."""

    async def send_todos(sid: str, user_id: int) -> None:
        todos = await services.todos.list_todos(user_id)
        await sio.emit(ServerEvent.ALL_TODOS, todos, room=sid)

    @sio.on(ClientEvent.GET_TODOS)
    @handle_service_errors(sio)
    @authenticated(sio)
    async def handle_get_todos(sid, user_id):
        await send_todos(sid, user_id)

    @sio.on(ClientEvent.SYNC_TODO)
    @handle_service_errors(sio)
    @authenticated(sio)
    async def handle_sync(sid, user_id, data):
        outcome = await services.todos.sync(user_id, data)
        if outcome.deleted:
            await sio.emit(ServerEvent.TODO_DELETED, data["id"], room=sid)
        elif outcome.updated:
            await sio.emit(
                ServerEvent.TODO_UPDATED, data, room=user_id, skip_sid=sid
            )

    @sio.on(ClientEvent.DELETE_TODO)
    @handle_service_errors(sio)
    @authenticated(sio)
    async def handle_delete_todo(sid, user_id, todo_id):
        await services.todos.delete(user_id, todo_id)
        await sio.emit(
            ServerEvent.TODO_DELETED, todo_id, room=user_id, skip_sid=sid
        )

    @sio.on(ClientEvent.CONFIRM_RESET)
    @handle_service_errors(sio)
    @authenticated(sio)
    async def handle_reset_todos(sid, user_id, todo_type, update_time):
        await services.todos.reset_by_type(user_id, todo_type, update_time)
        await send_todos(sid, user_id)

    @sio.on(ClientEvent.BULK_SYNC_TODOS)
    @handle_service_errors(sio)
    @authenticated(sio)
    async def handle_bulk_sync_todos(sid, user_id, client_todos):
        for todo, outcome in await services.todos.bulk_sync(user_id, client_todos):
            if outcome.deleted:
                await sio.emit(ServerEvent.TODO_DELETED, todo["id"], room=sid)
            elif outcome.updated:
                await sio.emit(
                    ServerEvent.TODO_UPDATED, todo, room=user_id, skip_sid=sid
                )

        await send_todos(sid, user_id)


__all__ = ["register"]

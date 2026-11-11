"""Socket-событие полного состояния пользователя для первичной загрузки.

``client:get_state`` заменяет последовательность отдельных запросов после
входа и переподключения: сервер одним событием отдаёт задачи, настройки и
историю за запрошенный (или текущий) месяц.
"""

import datetime

import socketio

from app.events.deps import authenticated
from app.events.errors import handle_service_errors
from app.events.names import ClientEvent, ServerEvent
from app.events.protocol import parse_request
from app.services import Services


def register(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует хендлер полного состояния."""

    @sio.on(ClientEvent.GET_STATE)
    @handle_service_errors(sio, ClientEvent.GET_STATE)
    @authenticated(sio)
    async def handle_get_state(sid, user_id, data=None):
        request = parse_request(data)
        month = request.payload if isinstance(request.payload, str) else None
        if month is None:
            month = datetime.datetime.now().strftime("%Y-%m")

        todos = await services.todos.list_todos(user_id)
        settings = await services.settings.get(user_id)
        history = await services.daily_history.get_month(user_id, month)

        await sio.emit(
            ServerEvent.STATE,
            {
                "request_id": request.request_id,
                "todos": todos,
                "settings": settings,
                "history": {"month": month, "entries": history},
            },
            room=sid,
        )


__all__ = ["register"]

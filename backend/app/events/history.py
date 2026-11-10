"""Socket-события ежедневной истории."""

import datetime

import socketio

from app.events.deps import authenticated
from app.events.errors import handle_service_errors
from app.events.names import ClientEvent, ServerEvent
from app.services import Services


def register(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует хендлеры истории на сервере."""

    async def send_month_history(sid: str, user_id: int, month_str: str) -> None:
        history = await services.daily_history.get_month(user_id, month_str)
        await sio.emit(
            ServerEvent.MONTH_HISTORY,
            {"month": month_str, "history": history},
            room=sid,
        )

    @sio.on(ClientEvent.GET_MONTH_HISTORY)
    @handle_service_errors(sio)
    @authenticated(sio)
    async def handle_get_month_history(sid, user_id, month_str):
        await send_month_history(sid, user_id, month_str)

    @sio.on(ClientEvent.SYNC_DAILY_HISTORY)
    @handle_service_errors(sio)
    @authenticated(sio)
    async def handle_sync_daily_history(sid, user_id, data):
        entry, updated = await services.daily_history.sync(user_id, data)
        if updated:
            await sio.emit(
                ServerEvent.DAILY_HISTORY_UPDATED,
                entry,
                room=user_id,
                skip_sid=sid,
            )

    @sio.on(ClientEvent.BULK_SYNC_DAILY_HISTORY)
    @handle_service_errors(sio)
    @authenticated(sio)
    async def handle_bulk_sync_daily_history(sid, user_id, client_history):
        for entry, updated in await services.daily_history.bulk_sync(
            user_id, client_history
        ):
            if updated:
                await sio.emit(
                    ServerEvent.DAILY_HISTORY_UPDATED,
                    entry,
                    room=user_id,
                    skip_sid=sid,
                )

        cur_month = datetime.datetime.now().strftime("%Y-%m")
        await send_month_history(sid, user_id, cur_month)


__all__ = ["register"]

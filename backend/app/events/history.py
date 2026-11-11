"""Socket-события ежедневной истории."""

import datetime

import socketio

from app.events.deps import authenticated
from app.events.errors import handle_service_errors
from app.events.names import ClientEvent, ServerEvent
from app.events.protocol import AckStatus, emit_ack, parse_request
from app.services import Services


def register(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует хендлеры истории на сервере."""

    async def send_month_history(
        sid: str,
        user_id: int,
        month_str: str,
        request_id: str | None = None,
    ) -> None:
        history = await services.daily_history.get_month(user_id, month_str)
        await sio.emit(
            ServerEvent.MONTH_HISTORY,
            {
                "month": month_str,
                "history": history,
                "request_id": request_id,
            },
            room=sid,
        )

    @sio.on(ClientEvent.GET_MONTH_HISTORY)
    @handle_service_errors(sio, ClientEvent.GET_MONTH_HISTORY)
    @authenticated(sio)
    async def handle_get_month_history(sid, user_id, month_str):
        request = parse_request(month_str)
        await send_month_history(
            sid, user_id, request.payload, request.request_id
        )

    @sio.on(ClientEvent.SYNC_DAILY_HISTORY)
    @handle_service_errors(sio, ClientEvent.SYNC_DAILY_HISTORY, ack=True)
    @authenticated(sio)
    async def handle_sync_daily_history(sid, user_id, data):
        request = parse_request(data)
        entry, updated = await services.daily_history.sync(user_id, request.payload)
        if updated:
            await sio.emit(
                ServerEvent.DAILY_HISTORY_UPDATED,
                entry,
                room=user_id,
                skip_sid=sid,
            )
            status = AckStatus.APPLIED
        else:
            status = AckStatus.CONFLICT

        await emit_ack(
            sio,
            sid,
            ClientEvent.SYNC_DAILY_HISTORY,
            request.request_id,
            status,
            entry,
        )

    @sio.on(ClientEvent.BULK_SYNC_DAILY_HISTORY)
    @handle_service_errors(sio, ClientEvent.BULK_SYNC_DAILY_HISTORY, ack=True)
    @authenticated(sio)
    async def handle_bulk_sync_daily_history(sid, user_id, client_history):
        request = parse_request(client_history)
        results = []
        for entry, updated in await services.daily_history.bulk_sync(
            user_id, request.payload
        ):
            if updated:
                await sio.emit(
                    ServerEvent.DAILY_HISTORY_UPDATED,
                    entry,
                    room=user_id,
                    skip_sid=sid,
                )
            results.append(
                {
                    "date": entry["date"],
                    "status": AckStatus.APPLIED if updated else AckStatus.CONFLICT,
                    "entry": entry,
                }
            )

        cur_month = datetime.datetime.now().strftime("%Y-%m")
        await send_month_history(sid, user_id, cur_month)
        await emit_ack(
            sio,
            sid,
            ClientEvent.BULK_SYNC_DAILY_HISTORY,
            request.request_id,
            AckStatus.PROCESSED,
            {"results": results},
        )


__all__ = ["register"]

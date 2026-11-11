"""Socket-события пользовательских настроек."""

import socketio

from app.events.deps import authenticated
from app.events.errors import handle_service_errors
from app.events.names import ClientEvent, ServerEvent
from app.events.protocol import AckStatus, emit_ack, parse_request
from app.services import Services


def register(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует хендлеры настроек на сервере."""

    @sio.on(ClientEvent.UPDATE_SETTINGS)
    @handle_service_errors(sio, ClientEvent.UPDATE_SETTINGS, ack=True)
    @authenticated(sio)
    async def handle_update_settings(sid, user_id, settings_dict):
        request = parse_request(settings_dict)
        actual_settings, applied = await services.settings.update(
            user_id, request.payload
        )

        if applied:
            await sio.emit(
                ServerEvent.SETTINGS_UPDATED,
                actual_settings,
                room=user_id,
                skip_sid=sid,
            )
            status = AckStatus.APPLIED
        else:
            # Конфликт: серверная версия приходит в ack, без дубля.
            status = AckStatus.CONFLICT

        await emit_ack(
            sio,
            sid,
            ClientEvent.UPDATE_SETTINGS,
            request.request_id,
            status,
            actual_settings,
        )


__all__ = ["register"]

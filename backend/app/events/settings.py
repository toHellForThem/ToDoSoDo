"""Socket-события пользовательских настроек."""

import socketio

from app.events.deps import authenticated
from app.events.errors import handle_service_errors
from app.events.names import ClientEvent, ServerEvent
from app.services import Services


def register(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует хендлеры настроек на сервере."""

    @sio.on(ClientEvent.UPDATE_SETTINGS)
    @handle_service_errors(sio)
    @authenticated(sio)
    async def handle_update_settings(sid, user_id, settings_dict):
        actual_settings, applied = await services.settings.update(
            user_id, settings_dict
        )
        if applied:
            await sio.emit(
                ServerEvent.SETTINGS_UPDATED,
                actual_settings,
                room=user_id,
                skip_sid=sid,
            )
        else:
            await sio.emit(ServerEvent.SETTINGS_UPDATED, actual_settings, room=sid)


__all__ = ["register"]

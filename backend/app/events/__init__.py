"""Транспортный слой: socket-события, разложенные по модулям."""

import socketio

from app.events import auth, history, settings, state, todos
from app.services import Services


def register_all(sio: socketio.AsyncServer, services: Services) -> None:
    """Регистрирует все хендлеры на переданном сервере."""
    auth.register(sio, services)
    todos.register(sio, services)
    history.register(sio, services)
    settings.register(sio, services)
    state.register(sio, services)


__all__ = ["register_all"]

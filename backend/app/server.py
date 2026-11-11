"""Сборка FastAPI-приложения и Socket.IO сервера."""

import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Database
from app.events import register_all
from app.logging_config import setup_logging
from app.services import Services, build_services

logger = logging.getLogger(__name__)


@dataclass
class Server:
    """Собранный сервер: ASGI-приложение и его зависимости."""

    asgi: socketio.ASGIApp
    app: FastAPI
    sio: socketio.AsyncServer
    db: Database
    services: Services


def create_server(database_path: str | None = None) -> Server:
    """Собирает FastAPI + Socket.IO с подключением к БД и хендлерами."""
    setup_logging()

    db = Database(database_path or settings.database_path)
    services = build_services(db)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await db.connect()
        await db.init_schema()
        yield
        await db.close()

    sio = socketio.AsyncServer(
        async_mode="asgi", cors_allowed_origins=settings.sio_origins
    )
    app = FastAPI(lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_all(sio, services)

    return Server(
        asgi=socketio.ASGIApp(sio, app),
        app=app,
        sio=sio,
        db=db,
        services=services,
    )


__all__ = ["Server", "create_server"]

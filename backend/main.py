import datetime
import json
import logging
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Database
from app.logging_config import setup_logging
from app.services import AuthError, ConflictError, ValidationError, build_services

setup_logging()
logger = logging.getLogger(__name__)

db = Database(settings.database_path)
services = build_services(db)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    await db.init_schema()
    yield
    await db.close()


origins = settings.cors_origins

sio = socketio.AsyncServer(
    async_mode="asgi", cors_allowed_origins=settings.sio_cors_origins
)
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

socket_app = socketio.ASGIApp(sio, app)


async def _emit_auth_error(sid, message: str) -> None:
    await sio.emit(
        "server:auth_message",
        {"status": "error", "message": message},
        room=sid,
    )


@sio.on("client:register")
async def handle_register(sid, data):
    username = data.get("username")
    try:
        await services.auth.register(username, data.get("password"))
    except (ValidationError, ConflictError) as exc:
        await _emit_auth_error(sid, exc.message)
        return

    await sio.emit("server:register_success", {"msg": "Аккаунт создан!"}, room=sid)
    await sio.emit(
        "server:auth_message",
        {
            "status": "success",
            "message": f"Пользователь {username} успешно зарегистрирован!",
        },
        room=sid,
    )


@sio.on("client:login")
async def handle_login(sid, data):
    try:
        result = await services.auth.login(data["username"], data["password"])
    except AuthError as exc:
        await _emit_auth_error(sid, exc.message)
        return

    await sio.save_session(sid, {"user_id": result["user_id"]})
    await sio.enter_room(sid, result["user_id"])

    await sio.emit(
        "server:login_success",
        {
            "username": result["username"],
            "token": result["token"],
            "settings": result["settings"],
        },
        room=sid,
    )
    await sio.emit(
        "server:auth_message",
        {
            "status": "success",
            "message": "Вход выполнен успешно!",
        },
        room=sid,
    )


@sio.event
async def connect(sid, environ, auth):
    logger.info("Клиент подключается: %s", sid)
    token = auth.get("token") if auth else None
    user_id, expired = services.auth.decode_token(token)

    if not user_id:
        return True

    if expired:
        logger.warning(
            "Сессия пользователя %s истекла, требуется повторный вход", user_id
        )
        await sio.emit("server:auth_expired", room=sid)
        return True

    user = await services.auth.get_user(user_id)
    if not user:
        logger.warning("Пользователь с ID %s не найден в базе данных", user_id)
        return True

    await sio.save_session(sid, {"user_id": user["id"]})
    await sio.enter_room(sid, user["id"])

    await sio.emit(
        "server:login_success",
        {
            "username": user["username"],
            "token": token,
            "settings": json.loads(user["settings"]),
        },
        room=sid,
    )

    return True


@sio.on("client:get_todos")
async def handle_get_todos(sid):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")

    if not user_id:
        logger.warning("Запрос задач без авторизации (sid=%s)", sid)
        return

    todos = await services.todos.list_todos(user_id)

    await sio.emit("server:all_todos", todos, room=sid)


@sio.on("client:sync_todo")
async def handle_sync(sid, data):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        logger.warning("Синхронизация задачи без авторизации (sid=%s)", sid)
        return

    outcome = await services.todos.sync(user_id, data)
    if outcome.deleted:
        await sio.emit("server:todo_deleted", data["id"], room=sid)
    elif outcome.updated:
        await sio.emit("server:todo_updated", data, room=user_id, skip_sid=sid)


@sio.on("client:delete_todo")
async def handle_delete_todo(sid, todo_id):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")

    if not user_id:
        logger.warning("Удаление задачи без авторизации (sid=%s)", sid)
        return

    await services.todos.delete(user_id, todo_id)
    await sio.emit("server:todo_deleted", todo_id, room=user_id, skip_sid=sid)


@sio.on("client:logout")
async def handle_logout(sid):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")

    if not user_id:
        logger.warning("Выход без авторизации (sid=%s)", sid)
        return

    await sio.leave_room(sid, user_id)
    await sio.save_session(sid, {})


@sio.on("client:confirm_reset")
async def handle_reset_todos(sid, todo_type, update_time):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")

    if not user_id:
        return

    await services.todos.reset_by_type(user_id, todo_type, update_time)
    await handle_get_todos(sid)


@sio.on("client:get_month_history")
async def handle_get_month_history(sid, month_str):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    history = await services.daily_history.get_month(user_id, month_str)

    await sio.emit(
        "server:month_history", {"month": month_str, "history": history}, room=sid
    )


@sio.on("client:sync_daily_history")
async def handle_sync_daily_history(sid, data):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    if await services.daily_history.sync(user_id, data):
        await sio.emit(
            "server:daily_history_updated", data, room=user_id, skip_sid=sid
        )


@sio.on("client:bulk_sync_todos")
async def handle_bulk_sync_todos(sid, client_todos):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    for todo, outcome in await services.todos.bulk_sync(user_id, client_todos):
        if outcome.deleted:
            await sio.emit("server:todo_deleted", todo["id"], room=sid)
        elif outcome.updated:
            await sio.emit("server:todo_updated", todo, room=user_id, skip_sid=sid)

    await handle_get_todos(sid)


@sio.on("client:bulk_sync_daily_history")
async def handle_bulk_sync_daily_history(sid, client_history):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    for entry, updated in await services.daily_history.bulk_sync(
        user_id, client_history
    ):
        if updated:
            await sio.emit(
                "server:daily_history_updated", entry, room=user_id, skip_sid=sid
            )

    cur_month = datetime.datetime.now().strftime("%Y-%m")
    await handle_get_month_history(sid, cur_month)


@sio.on("client:update_settings")
async def handle_update_settings(sid, settings_dict):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    actual_settings, applied = await services.settings.update(user_id, settings_dict)
    if applied:
        await sio.emit(
            "server:settings_updated", actual_settings, room=user_id, skip_sid=sid
        )
    else:
        await sio.emit("server:settings_updated", actual_settings, room=sid)

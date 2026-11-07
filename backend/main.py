import datetime
import json
import logging
from contextlib import asynccontextmanager
from datetime import timezone

import jwt
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from werkzeug.security import check_password_hash, generate_password_hash

from app.config import settings
from app.database import Database
from app.logging_config import setup_logging
from app.rep import (
    DailyHistoryRepository,
    DeletedTodosRepository,
    TodosRepository,
    UsersRepository,
)
from app.schemas import Todo

setup_logging()
logger = logging.getLogger(__name__)


def create_access_token(user_id: int):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.now(timezone.utc) + datetime.timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str):
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return (payload.get("user_id"),)
    except jwt.ExpiredSignatureError:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm], options={"verify_exp": False}
        )
        return (payload.get("user_id"), "expired")
    except jwt.InvalidTokenError:
        return None


db = Database(settings.database_path)
users_repo = UsersRepository(db)
todos_repo = TodosRepository(db)
deleted_todos_repo = DeletedTodosRepository(db)
daily_history_repo = DailyHistoryRepository(db)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    await db.init_schema()
    yield
    await db.close()


origins = settings.cors_origins

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=settings.sio_cors_origins)
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

socket_app = socketio.ASGIApp(sio, app)


@sio.on("client:register")
async def handle_register(sid, data):
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        await sio.emit(
            "server:auth_message",
            {
                "status": "error",
                "message": "Заполните все поля!",
            },
            room=sid,
        )
        return

    password_hash = generate_password_hash(password)
    default_settings = json.dumps(
        {"main_page": "todo", "theme": "default", "soft_delete": True}
    )

    try:
        await users_repo.create(username, password_hash, default_settings)
        logger.info("Пользователь %s успешно зарегистрирован", username)
        await sio.emit("server:register_success", {"msg": "Аккаунт создан!"}, room=sid)
        await sio.emit(
            "server:auth_message",
            {
                "status": "success",
                "message": f"Пользователь {username} успешно зарегистрирован!",
            },
            room=sid,
        )
    except Exception as e:
        logger.exception("Ошибка регистрации пользователя %s: %s", username, e)
        await sio.emit(
            "server:auth_message",
            {
                "status": "error",
                "message": "Такой логин уже занят",
            },
            room=sid,
        )


@sio.on("client:login")
async def handle_login(sid, data):
    user = await users_repo.get_by_username(data["username"])

    if not user:
        await sio.emit(
            "server:auth_message",
            {
                "status": "error",
                "message": "Такого пользователя не существует",
            },
            room=sid,
        )
        logger.warning("Попытка входа: пользователь %s не найден", data.get("username"))
        return

    if check_password_hash(user["password_hash"], data["password"]):
        token = create_access_token(user["id"])

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

        await sio.emit(
            "server:auth_message",
            {
                "status": "success",
                "message": "Вход выполнен успешно!",
            },
            room=sid,
        )
        logger.info("Пользователь %s вошёл в систему", user["username"])

    else:
        await sio.emit(
            "server:auth_message",
            {
                "status": "error",
                "message": "Неверный пароль",
            },
            room=sid,
        )
        logger.warning("Неверный пароль для пользователя %s", data.get("username"))


@sio.event
async def connect(sid, environ, auth):
    logger.info("Клиент подключается: %s", sid)
    token = auth.get("token") if auth else None
    user_id = decode_token(token)

    if user_id:
        if len(user_id) > 1:
            logger.warning("Сессия пользователя %s истекла, требуется повторный вход", user_id[0])
            await sio.emit("server:auth_expired", room=sid)
            return True

        user = await users_repo.get_by_id(user_id[0])
        if not user:
            logger.warning("Пользователь с ID %s не найден в базе данных", user_id[0])
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

    todos = [todo.model_dump() for todo in await todos_repo.list_by_user(user_id)]

    await sio.emit("server:all_todos", todos, room=sid)


@sio.on("client:sync_todo")
async def handle_sync(sid, data):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        logger.warning("Синхронизация задачи без авторизации (sid=%s)", sid)
        return

    todo_id = data["id"]
    client_updated_at = data.get("updatedAt", 0)
    server_updated_at = await todos_repo.get_updated_at(todo_id, user_id)
    is_deleted = await deleted_todos_repo.exists(user_id, todo_id)
    if not is_deleted:
        if server_updated_at is None or client_updated_at > server_updated_at:
            await todos_repo.upsert(Todo(**data), user_id)
            await sio.emit("server:todo_updated", data, room=user_id, skip_sid=sid)
            logger.debug("Обновлено: %s (клиентская версия новее)", data["text"])
        else:
            logger.debug("На сервере данные новее для: %s", data["text"])
    else:
        await sio.emit("server:todo_deleted", todo_id, room=sid)


@sio.on("client:delete_todo")
async def handle_delete_todo(sid, todo_id):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")

    if not user_id:
        logger.warning("Удаление задачи без авторизации (sid=%s)", sid)
        return

    now = int(datetime.datetime.now(timezone.utc).timestamp() * 1000)

    await deleted_todos_repo.add(todo_id, user_id, now)
    await todos_repo.delete(todo_id, user_id)
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

    await todos_repo.reset_by_type(user_id, todo_type, update_time)
    logger.info("Пользователь %s обновил задачи (type=%s)", user_id, todo_type)
    await handle_get_todos(sid)


@sio.on("client:get_month_history")
async def handle_get_month_history(sid, month_str):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    history = await daily_history_repo.list_by_month(user_id, month_str)

    await sio.emit("server:month_history", {"month": month_str, "history": history}, room=sid)


@sio.on("client:sync_daily_history")
async def handle_sync_daily_history(sid, data):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    date = data["date"]
    client_updated_at = data.get("updatedAt", 0)

    server_updated_at = await daily_history_repo.get_updated_at(user_id, date)
    if server_updated_at is None or client_updated_at > server_updated_at:
        await daily_history_repo.upsert(data, user_id)
        await sio.emit("server:daily_history_updated", data, room=user_id, skip_sid=sid)


@sio.on("client:bulk_sync_todos")
async def handle_bulk_sync_todos(sid, client_todos):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    for todo in client_todos:
        todo_id = todo["id"]
        client_updated_at = todo.get("updatedAt", 0)
        server_updated_at = await todos_repo.get_updated_at(todo_id, user_id)
        is_deleted = await deleted_todos_repo.exists(user_id, todo_id)
        if not is_deleted:
            if server_updated_at is None or client_updated_at > server_updated_at:
                await todos_repo.upsert(Todo(**todo), user_id)
                await sio.emit("server:todo_updated", todo, room=user_id, skip_sid=sid)
        else:
            await sio.emit("server:todo_deleted", todo_id, room=sid)

    await handle_get_todos(sid)


@sio.on("client:bulk_sync_daily_history")
async def handle_bulk_sync_daily_history(sid, client_history):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    for entry in client_history:
        date = entry["date"]
        client_updated_at = entry.get("updatedAt", 0)

        server_updated_at = await daily_history_repo.get_updated_at(user_id, date)
        if server_updated_at is None or client_updated_at > server_updated_at:
            await daily_history_repo.upsert(entry, user_id)
            await sio.emit("server:daily_history_updated", entry, room=user_id, skip_sid=sid)

    cur_month = datetime.datetime.now().strftime("%Y-%m")
    await handle_get_month_history(sid, cur_month)


@sio.on("client:update_settings")
async def handle_update_settings(sid, settings_dict):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    user = await users_repo.get_by_id(user_id)
    if user and user["settings"]:
        current_settings = json.loads(user["settings"])
        current_updated_at = current_settings.get("updatedAt", 0)
        client_updated_at = settings_dict.get("updatedAt", 0)

        if client_updated_at > current_updated_at:
            await users_repo.update_settings(user_id, json.dumps(settings_dict))
            logger.info("Пользователь %s обновил настройки", user_id)
            await sio.emit("server:settings_updated", settings_dict, room=user_id, skip_sid=sid)
        else:
            logger.debug("На сервере настройки новее для пользователя %s", user_id)
            await sio.emit("server:settings_updated", current_settings, room=sid)
    else:
        await users_repo.update_settings(user_id, json.dumps(settings_dict))
        logger.info("Пользователь %s инициализировал настройки", user_id)
        await sio.emit("server:settings_updated", settings_dict, room=user_id, skip_sid=sid)

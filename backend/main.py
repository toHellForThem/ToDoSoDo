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
        await db.execute(
            "INSERT INTO users (username, password_hash, settings) VALUES (?, ?, ?)",
            (username, password_hash, default_settings),
        )
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
    user = await db.fetch_all(
        "SELECT * FROM users WHERE username = ?", (data["username"],)
    )

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

    user = user[0]

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

        user = await db.fetch_all(
            "SELECT * FROM users WHERE id = ?", (user_id[0],)
        )
        if not user:
            logger.warning("Пользователь с ID %s не найден в базе данных", user_id[0])
            return True

        user = user[0]

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

    rows = await db.fetch_all("SELECT * FROM todos WHERE user_id = ?", (user_id,))

    todos = []
    for r in rows:
        todo_obj = Todo(
            id=r["id"],
            text=r["text"],
            completed=bool(r["completed"]),
            deleted=bool(r["deleted"]),
            updatedAt=int(r["updated_at"]),
            type=r["type"],
            progressNow=r["progress_now"],
            progressEnd=r["progress_end"],
            contribution=r["contribution"] if "contribution" in r.keys() else 0,
            days=r["days"] if "days" in r.keys() else "1111111"
        )
        todos.append(todo_obj.model_dump())

    await sio.emit("server:all_todos", todos, room=sid)


@sio.on("client:sync_todo")
async def handle_sync(sid, data):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        logger.warning("Синхронизация задачи без авторизации (sid=%s)", sid)
        return

    participants = list(sio.manager.get_participants("/", user_id))

    todo_id = data["id"]
    client_updated_at = data.get("updatedAt", 0)
    row = await db.fetch_all(
        "SELECT updated_at FROM todos WHERE id = ? AND user_id = ?",
        (todo_id, user_id),
    )
    is_deleted = await db.fetch_all(
        "SELECT 1 FROM deleted_todos WHERE user_id = ? AND id = ? LIMIT 1",
        (user_id, todo_id),
    )
    if not is_deleted:
        if not row or client_updated_at > row[0]["updated_at"]:
            await db.execute(
                """
                INSERT OR REPLACE INTO todos (id, text, completed, deleted, updated_at, type, progress_now, progress_end, user_id, contribution, days)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    data["id"],
                    data["text"],
                    data["completed"],
                    data["deleted"],
                    client_updated_at,
                    data["type"],
                    str(data["progressNow"]),
                    str(data["progressEnd"]),
                    user_id,
                    data.get("contribution", 0),
                    data.get("days", "1111111")
                ),
            )
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

    await db.execute(
        "INSERT OR IGNORE INTO deleted_todos (id, user_id, deleted_at) VALUES (?, ?, ?)",
        (todo_id, user_id, now),
    )

    await db.execute("DELETE FROM todos WHERE id = ? AND user_id = ?", (todo_id, user_id))
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

    await db.execute(
        """
        UPDATE todos 
        SET progress_now = 0, completed = ?, updated_at = ? 
        WHERE user_id = ? AND type = ?
    """,
        (False, update_time, user_id, todo_type),
    )
    logger.info("Пользователь %s обновил задачи (type=%s)", user_id, todo_type)
    await handle_get_todos(sid)


@sio.on("client:get_month_history")
async def handle_get_month_history(sid, month_str):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    like_pattern = f"{month_str}-%"
    history_rows = await db.fetch_all(
        "SELECT date, mood, daily_progress, pos_points, neg_points, habits_detail, updated_at FROM daily_history WHERE user_id = ? AND date LIKE ?",
        (user_id, like_pattern),
    )

    history = []
    for r in history_rows:
        history.append(
            {
                "date": r["date"],
                "mood": r["mood"],
                "daily_progress": r["daily_progress"],
                "pos_points": r["pos_points"],
                "neg_points": r["neg_points"],
                "habits_detail": r["habits_detail"] if "habits_detail" in r.keys() else "[]",
                "updatedAt": r["updated_at"] if "updated_at" in r.keys() else 0,
            }
        )

    await sio.emit("server:month_history", {"month": month_str, "history": history}, room=sid)


@sio.on("client:sync_daily_history")
async def handle_sync_daily_history(sid, data):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    date = data["date"]
    mood = data.get("mood")
    daily_progress = data.get("daily_progress", 0.0)
    pos_points = data.get("pos_points", 0)
    neg_points = data.get("neg_points", 0)
    habits_detail = data.get("habits_detail", "[]")
    client_updated_at = data.get("updatedAt", 0)

    row = await db.fetch_all(
        "SELECT updated_at FROM daily_history WHERE user_id = ? AND date = ?",
        (user_id, date),
    )
    if not row or client_updated_at > row[0]["updated_at"]:
        await db.execute(
            """
            INSERT OR REPLACE INTO daily_history (user_id, date, mood, daily_progress, pos_points, neg_points, habits_detail, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (user_id, date, mood, daily_progress, pos_points, neg_points, habits_detail, client_updated_at),
        )
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
        row = await db.fetch_all(
            "SELECT updated_at FROM todos WHERE id = ? AND user_id = ?",
            (todo_id, user_id),
        )
        is_deleted = await db.fetch_all(
            "SELECT 1 FROM deleted_todos WHERE user_id = ? AND id = ? LIMIT 1",
            (user_id, todo_id),
        )
        if not is_deleted:
            if not row or client_updated_at > row[0]["updated_at"]:
                await db.execute(
                    """
                    INSERT OR REPLACE INTO todos (id, text, completed, deleted, updated_at, type, progress_now, progress_end, user_id, contribution, days)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        todo["id"],
                        todo["text"],
                        todo["completed"],
                        todo["deleted"],
                        client_updated_at,
                        todo["type"],
                        str(todo["progressNow"]),
                        str(todo["progressEnd"]),
                        user_id,
                        todo.get("contribution", 0),
                        todo.get("days", "1111111")
                    ),
                )
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
        mood = entry.get("mood")
        daily_progress = entry.get("daily_progress", 0.0)
        pos_points = entry.get("pos_points", 0)
        neg_points = entry.get("neg_points", 0)
        habits_detail = entry.get("habits_detail", "[]")
        client_updated_at = entry.get("updatedAt", 0)

        row = await db.fetch_all(
            "SELECT updated_at FROM daily_history WHERE user_id = ? AND date = ?",
            (user_id, date),
        )
        if not row or client_updated_at > row[0]["updated_at"]:
            await db.execute(
                """
                INSERT OR REPLACE INTO daily_history (user_id, date, mood, daily_progress, pos_points, neg_points, habits_detail, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (user_id, date, mood, daily_progress, pos_points, neg_points, habits_detail, client_updated_at),
            )
            await sio.emit("server:daily_history_updated", entry, room=user_id, skip_sid=sid)

    cur_month = datetime.datetime.now().strftime("%Y-%m")
    await handle_get_month_history(sid, cur_month)


@sio.on("client:update_settings")
async def handle_update_settings(sid, settings_dict):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if not user_id:
        return

    user = await db.fetch_all(
        "SELECT settings FROM users WHERE id = ?", (user_id,)
    )
    if user and user[0]["settings"]:
        current_settings = json.loads(user[0]["settings"])
        current_updated_at = current_settings.get("updatedAt", 0)
        client_updated_at = settings_dict.get("updatedAt", 0)

        if client_updated_at > current_updated_at:
            settings_json = json.dumps(settings_dict)
            await db.execute(
                "UPDATE users SET settings = ? WHERE id = ?",
                (settings_json, user_id)
            )
            logger.info("Пользователь %s обновил настройки", user_id)
            await sio.emit("server:settings_updated", settings_dict, room=user_id, skip_sid=sid)
        else:
            logger.debug("На сервере настройки новее для пользователя %s", user_id)
            await sio.emit("server:settings_updated", current_settings, room=sid)
    else:
        settings_json = json.dumps(settings_dict)
        await db.execute(
            "UPDATE users SET settings = ? WHERE id = ?",
            (settings_json, user_id)
        )
        logger.info("Пользователь %s инициализировал настройки", user_id)
        await sio.emit("server:settings_updated", settings_dict, room=user_id, skip_sid=sid)

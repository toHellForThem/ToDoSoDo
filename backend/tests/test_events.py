"""Интеграционные тесты socket-событий через живой uvicorn.

Socket.IO выполняет хендлеры независимыми задачами, поэтому тесты не
полагаются на порядок обработки разных событий: после мутирующего события
ждём его широковещательную копию во второй сессии того же пользователя.
"""

import asyncio
import datetime
import functools
import socket

import pytest_asyncio
import socketio
import uvicorn

from app.events.names import ClientEvent, ServerEvent
from app.server import create_server

SERVER_EVENTS = [
    ServerEvent.AUTH_MESSAGE,
    ServerEvent.AUTH_EXPIRED,
    ServerEvent.REGISTER_SUCCESS,
    ServerEvent.LOGIN_SUCCESS,
    ServerEvent.STATE,
    ServerEvent.ALL_TODOS,
    ServerEvent.TODO_UPDATED,
    ServerEvent.TODO_DELETED,
    ServerEvent.MONTH_HISTORY,
    ServerEvent.DAILY_HISTORY_UPDATED,
    ServerEvent.SETTINGS_UPDATED,
    ServerEvent.ACK,
    ServerEvent.ERROR,
]


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Recorder:
    """Копит полученные события и умеет дождаться нужного."""

    def __init__(self) -> None:
        self.events: list[tuple[str, object]] = []

    async def on(self, name: str, data=None) -> None:
        self.events.append((name, data))

    def names(self) -> list[str]:
        return [name for name, _ in self.events]

    def clear(self) -> None:
        self.events.clear()

    async def wait(self, name: str, timeout: float = 5.0):
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        while loop.time() < deadline:
            for event_name, data in self.events:
                if event_name == name:
                    return data
            await asyncio.sleep(0.01)
        raise AssertionError(f"Событие {name} не получено: {self.names()}")


@pytest_asyncio.fixture
async def server_url(tmp_path):
    """Поднимает сервер на свободном порту."""
    server = create_server(str(tmp_path / "socket.db"))
    port = _free_port()
    config = uvicorn.Config(
        server.asgi, host="127.0.0.1", port=port, log_level="warning"
    )
    instance = uvicorn.Server(config)
    task = asyncio.create_task(instance.serve())
    while not instance.started:
        await asyncio.sleep(0.05)
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        instance.should_exit = True
        await task


@pytest_asyncio.fixture
async def connect(server_url):
    """Фабрика подключённых клиентов с рекордером событий."""
    clients: list[socketio.AsyncClient] = []

    async def _connect(auth: dict | None = None):
        client = socketio.AsyncClient()
        recorder = Recorder()
        for name in SERVER_EVENTS:
            client.on(name, functools.partial(recorder.on, name))
        await client.connect(server_url, auth=auth or {}, transports=["websocket"])
        clients.append(client)
        return client, recorder

    yield _connect

    for client in clients:
        if client.connected:
            await client.disconnect()


async def _register_and_login(client, recorder, username="alice", password="secret"):
    """Регистрирует пользователя и возвращает его токен."""
    recorder.clear()
    await client.emit(
        ClientEvent.REGISTER, {"username": username, "password": password}
    )
    await recorder.wait(ServerEvent.REGISTER_SUCCESS)

    recorder.clear()
    await client.emit(ClientEvent.LOGIN, {"username": username, "password": password})
    login = await recorder.wait(ServerEvent.LOGIN_SUCCESS)
    recorder.clear()
    return login["token"]


@pytest_asyncio.fixture
async def sessions(connect):
    """Владелец и наблюдатель — две сессии одного пользователя."""
    owner, owner_recorder = await connect()
    token = await _register_and_login(owner, owner_recorder)

    observer, observer_recorder = await connect(auth={"token": token})
    assert (await observer_recorder.wait(ServerEvent.LOGIN_SUCCESS))["username"] == (
        "alice"
    )

    owner_recorder.clear()
    observer_recorder.clear()
    return owner, owner_recorder, observer, observer_recorder


async def test_register_login_and_get_todos(connect):
    client, recorder = await connect()

    await client.emit(ClientEvent.REGISTER, {"username": "alice", "password": "secret"})
    assert await recorder.wait(ServerEvent.REGISTER_SUCCESS) == {
        "msg": "Аккаунт создан!"
    }
    assert (await recorder.wait(ServerEvent.AUTH_MESSAGE))["status"] == "success"

    recorder.clear()
    await client.emit(ClientEvent.LOGIN, {"username": "alice", "password": "secret"})
    login = await recorder.wait(ServerEvent.LOGIN_SUCCESS)
    assert login["username"] == "alice"
    assert login["token"]

    recorder.clear()
    await client.emit(ClientEvent.GET_TODOS)
    assert await recorder.wait(ServerEvent.ALL_TODOS) == []


async def test_register_without_password_returns_auth_error(connect):
    client, recorder = await connect()

    await client.emit(ClientEvent.REGISTER, {"username": "alice", "password": ""})

    assert await recorder.wait(ServerEvent.AUTH_MESSAGE) == {
        "status": "error",
        "message": "Заполните все поля!",
    }


async def test_login_with_wrong_password_returns_auth_error(connect):
    client, recorder = await connect()
    await _register_and_login(client, recorder)

    await client.emit(ClientEvent.LOGIN, {"username": "alice", "password": "wrong"})

    assert await recorder.wait(ServerEvent.AUTH_MESSAGE) == {
        "status": "error",
        "message": "Неверный пароль",
    }


async def test_unauthorized_events_are_ignored(connect):
    client, recorder = await connect()

    await client.emit(ClientEvent.GET_TODOS)
    await asyncio.sleep(0.3)

    assert ServerEvent.ALL_TODOS not in recorder.names()


async def test_logout_clears_session(connect):
    client, recorder = await connect()
    await _register_and_login(client, recorder)

    await client.emit(ClientEvent.LOGOUT)
    await asyncio.sleep(0.2)
    recorder.clear()

    await client.emit(ClientEvent.GET_TODOS)
    await asyncio.sleep(0.3)

    assert ServerEvent.ALL_TODOS not in recorder.names()


async def test_sync_todo_is_broadcast_and_listed(sessions):
    owner, owner_recorder, _, observer_recorder = sessions

    await owner.emit(
        ClientEvent.SYNC_TODO, {"id": "t1", "text": "task", "updatedAt": 100}
    )
    assert (await observer_recorder.wait(ServerEvent.TODO_UPDATED))["id"] == "t1"

    await owner.emit(ClientEvent.GET_TODOS)
    todos = await owner_recorder.wait(ServerEvent.ALL_TODOS)
    assert [todo["id"] for todo in todos] == ["t1"]
    assert ServerEvent.TODO_UPDATED not in owner_recorder.names()


async def test_delete_todo_removes_it(sessions):
    owner, owner_recorder, _, observer_recorder = sessions

    await owner.emit(
        ClientEvent.SYNC_TODO, {"id": "t1", "text": "task", "updatedAt": 100}
    )
    await observer_recorder.wait(ServerEvent.TODO_UPDATED)
    observer_recorder.clear()
    owner_recorder.clear()

    await owner.emit(ClientEvent.DELETE_TODO, "t1")
    assert await observer_recorder.wait(ServerEvent.TODO_DELETED) == "t1"

    await owner.emit(ClientEvent.GET_TODOS)
    assert await owner_recorder.wait(ServerEvent.ALL_TODOS) == []


async def test_garbage_payload_returns_validation_error(sessions):
    owner, owner_recorder, _, _ = sessions

    await owner.emit(ClientEvent.SYNC_TODO, {"id": "t1", "days": "nope"})
    error = await owner_recorder.wait(ServerEvent.ERROR)
    assert error["code"] == "validation_error"
    assert "Некорректная задача" in error["message"]

    owner_recorder.clear()
    await owner.emit(ClientEvent.GET_TODOS)
    assert await owner_recorder.wait(ServerEvent.ALL_TODOS) == []


async def test_bulk_sync_returns_remaining_todos(sessions):
    owner, owner_recorder, _, _ = sessions

    await owner.emit(
        ClientEvent.BULK_SYNC_TODOS,
        [
            {"id": "t2", "text": "second", "updatedAt": 1},
            {"id": "t1", "text": "first", "updatedAt": 1},
        ],
    )

    todos = await owner_recorder.wait(ServerEvent.ALL_TODOS)
    assert sorted(todo["id"] for todo in todos) == ["t1", "t2"]


async def test_confirm_reset_returns_reset_todos(sessions):
    owner, owner_recorder, _, observer_recorder = sessions

    await owner.emit(
        ClientEvent.SYNC_TODO,
        {
            "id": "d1",
            "text": "daily",
            "type": "daily",
            "completed": True,
            "progressNow": 2,
            "updatedAt": 1,
        },
    )
    await observer_recorder.wait(ServerEvent.TODO_UPDATED)
    owner_recorder.clear()

    await owner.emit(ClientEvent.CONFIRM_RESET, ("daily", 500))

    todos = await owner_recorder.wait(ServerEvent.ALL_TODOS)
    assert todos[0]["completed"] is False
    assert str(todos[0]["progressNow"]) == "0"
    assert todos[0]["updatedAt"] == 500


async def test_history_events(sessions):
    owner, owner_recorder, _, observer_recorder = sessions

    await owner.emit(
        ClientEvent.SYNC_DAILY_HISTORY,
        {"date": "2026-01-15", "mood": 3, "updatedAt": 5},
    )
    await observer_recorder.wait(ServerEvent.DAILY_HISTORY_UPDATED)
    owner_recorder.clear()

    await owner.emit(ClientEvent.GET_MONTH_HISTORY, "2026-01")
    data = await owner_recorder.wait(ServerEvent.MONTH_HISTORY)
    assert data["month"] == "2026-01"
    assert [entry["date"] for entry in data["history"]] == ["2026-01-15"]

    owner_recorder.clear()
    await owner.emit(
        ClientEvent.BULK_SYNC_DAILY_HISTORY,
        [{"date": "2026-01-16", "mood": 4, "updatedAt": 7}],
    )
    data = await owner_recorder.wait(ServerEvent.MONTH_HISTORY)
    assert data["month"] == datetime.datetime.now().strftime("%Y-%m")


async def test_settings_lww_over_events(sessions):
    owner, owner_recorder, _, observer_recorder = sessions

    await owner.emit(ClientEvent.UPDATE_SETTINGS, {"theme": "dark", "updatedAt": 10})
    data = await observer_recorder.wait(ServerEvent.SETTINGS_UPDATED)
    assert data["theme"] == "dark"
    assert data["updatedAt"] == 10
    assert data["reset_time"] == "00:00"

    owner_recorder.clear()
    await owner.emit(ClientEvent.UPDATE_SETTINGS, {"theme": "light", "updatedAt": 1})

    data = await owner_recorder.wait(ServerEvent.SETTINGS_UPDATED)
    assert data["theme"] == "dark"
    assert data["updatedAt"] == 10


async def test_sync_todo_ack_applied_with_request_id(sessions):
    owner, owner_recorder, _, _ = sessions

    await owner.emit(
        ClientEvent.SYNC_TODO,
        {
            "request_id": "r1",
            "payload": {"id": "t1", "text": "task", "updatedAt": 100},
        },
    )

    ack = await owner_recorder.wait(ServerEvent.ACK)
    assert ack["request_id"] == "r1"
    assert ack["event"] == ClientEvent.SYNC_TODO
    assert ack["status"] == "applied"
    assert ack["data"]["id"] == "t1"


async def test_sync_todo_conflict_returns_server_version(sessions):
    owner, owner_recorder, _, observer_recorder = sessions

    await owner.emit(
        ClientEvent.SYNC_TODO, {"id": "t1", "text": "server", "updatedAt": 100}
    )
    await observer_recorder.wait(ServerEvent.TODO_UPDATED)
    owner_recorder.clear()

    await owner.emit(
        ClientEvent.SYNC_TODO,
        {
            "request_id": "r2",
            "payload": {"id": "t1", "text": "client", "updatedAt": 50},
        },
    )

    ack = await owner_recorder.wait(ServerEvent.ACK)
    assert ack["request_id"] == "r2"
    assert ack["status"] == "conflict"
    assert ack["data"]["text"] == "server"
    assert ack["data"]["updatedAt"] == 100

    updated = await owner_recorder.wait(ServerEvent.TODO_UPDATED)
    assert updated["text"] == "server"


async def test_sync_todo_tombstone_ack(sessions):
    owner, owner_recorder, _, _ = sessions

    await owner.emit(ClientEvent.DELETE_TODO, "t1")
    owner_recorder.clear()

    await owner.emit(
        ClientEvent.SYNC_TODO,
        {
            "request_id": "r3",
            "payload": {"id": "t1", "text": "again", "updatedAt": 999},
        },
    )

    ack = await owner_recorder.wait(ServerEvent.ACK)
    assert ack["status"] == "deleted"
    assert ack["data"] == {"id": "t1"}


async def test_delete_todo_ack_with_request_id(sessions):
    owner, owner_recorder, _, _ = sessions

    await owner.emit(
        ClientEvent.DELETE_TODO, {"request_id": "d1", "payload": "t1"}
    )

    ack = await owner_recorder.wait(ServerEvent.ACK)
    assert ack["request_id"] == "d1"
    assert ack["event"] == ClientEvent.DELETE_TODO
    assert ack["status"] == "applied"
    assert ack["data"] == {"id": "t1"}


async def test_settings_conflict_ack_returns_server_version(sessions):
    owner, owner_recorder, _, observer_recorder = sessions

    await owner.emit(ClientEvent.UPDATE_SETTINGS, {"theme": "dark", "updatedAt": 10})
    await observer_recorder.wait(ServerEvent.SETTINGS_UPDATED)
    owner_recorder.clear()

    await owner.emit(
        ClientEvent.UPDATE_SETTINGS,
        {"request_id": "s1", "payload": {"theme": "pink", "updatedAt": 5}},
    )

    ack = await owner_recorder.wait(ServerEvent.ACK)
    assert ack["request_id"] == "s1"
    assert ack["status"] == "conflict"
    assert ack["data"]["theme"] == "dark"
    assert ack["data"]["updatedAt"] == 10


async def test_history_conflict_ack_returns_server_entry(sessions):
    owner, owner_recorder, _, observer_recorder = sessions

    await owner.emit(
        ClientEvent.SYNC_DAILY_HISTORY,
        {"date": "2026-01-15", "mood": 3, "updatedAt": 10},
    )
    await observer_recorder.wait(ServerEvent.DAILY_HISTORY_UPDATED)
    owner_recorder.clear()

    await owner.emit(
        ClientEvent.SYNC_DAILY_HISTORY,
        {
            "request_id": "h1",
            "payload": {"date": "2026-01-15", "mood": 1, "updatedAt": 5},
        },
    )

    ack = await owner_recorder.wait(ServerEvent.ACK)
    assert ack["request_id"] == "h1"
    assert ack["status"] == "conflict"
    assert ack["data"]["mood"] == 3


async def test_get_state_returns_todos_settings_history(sessions):
    owner, owner_recorder, _, observer_recorder = sessions

    await owner.emit(
        ClientEvent.SYNC_TODO, {"id": "t1", "text": "task", "updatedAt": 100}
    )
    await observer_recorder.wait(ServerEvent.TODO_UPDATED)
    await owner.emit(
        ClientEvent.SYNC_DAILY_HISTORY,
        {"date": "2026-01-15", "mood": 3, "updatedAt": 5},
    )
    await observer_recorder.wait(ServerEvent.DAILY_HISTORY_UPDATED)
    owner_recorder.clear()

    await owner.emit(
        ClientEvent.GET_STATE, {"request_id": "st1", "payload": "2026-01"}
    )

    state = await owner_recorder.wait(ServerEvent.STATE)
    assert state["request_id"] == "st1"
    assert [todo["id"] for todo in state["todos"]] == ["t1"]
    assert state["settings"]["theme"] == "default"
    assert state["history"]["month"] == "2026-01"
    assert [entry["date"] for entry in state["history"]["entries"]] == [
        "2026-01-15"
    ]


async def test_unauthorized_event_returns_error_with_request_id(connect):
    client, recorder = await connect()

    await client.emit(
        ClientEvent.SYNC_TODO,
        {"request_id": "u1", "payload": {"id": "t1", "text": "x"}},
    )

    error = await recorder.wait(ServerEvent.ERROR)
    assert error["code"] == "unauthorized"
    assert error["request_id"] == "u1"


async def test_validation_error_includes_request_id(sessions):
    owner, owner_recorder, _, _ = sessions

    await owner.emit(
        ClientEvent.SYNC_TODO,
        {"request_id": "bad1", "payload": {"id": "t1", "days": "nope"}},
    )

    error = await owner_recorder.wait(ServerEvent.ERROR)
    assert error["request_id"] == "bad1"
    assert error["event"] == ClientEvent.SYNC_TODO
    assert error["code"] == "validation_error"

    ack = await owner_recorder.wait(ServerEvent.ACK)
    assert ack["request_id"] == "bad1"
    assert ack["status"] == "rejected"


async def test_connect_with_invalid_token_emits_auth_expired(connect):
    _, recorder = await connect(auth={"token": "not-a-token"})

    await recorder.wait(ServerEvent.AUTH_EXPIRED)


async def test_legacy_payload_ack_has_no_request_id(sessions):
    owner, owner_recorder, _, _ = sessions

    await owner.emit(
        ClientEvent.SYNC_TODO, {"id": "t1", "text": "task", "updatedAt": 100}
    )

    ack = await owner_recorder.wait(ServerEvent.ACK)
    assert ack["request_id"] is None
    assert ack["status"] == "applied"

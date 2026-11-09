"""Тесты бизнес-логики сервисов."""

import datetime
from datetime import timezone

import jwt
import pytest

from app.config import settings
from app.services import AuthError, ConflictError, ValidationError


async def test_register_requires_credentials(services):
    with pytest.raises(ValidationError):
        await services.auth.register(None, "secret")

    with pytest.raises(ValidationError):
        await services.auth.register("alice", "")


async def test_register_duplicate_raises_conflict(services):
    await services.auth.register("alice", "secret")

    with pytest.raises(ConflictError):
        await services.auth.register("alice", "other")


async def test_login_returns_token_and_settings(services):
    await services.auth.register("alice", "secret")

    result = await services.auth.login("alice", "secret")

    assert result["username"] == "alice"
    assert result["settings"]["main_page"] == "todo"
    user_id, expired = services.auth.decode_token(result["token"])
    assert user_id == result["user_id"]
    assert expired is False


async def test_login_unknown_user_raises(services):
    with pytest.raises(AuthError):
        await services.auth.login("ghost", "secret")


async def test_login_wrong_password_raises(services):
    await services.auth.register("alice", "secret")

    with pytest.raises(AuthError):
        await services.auth.login("alice", "wrong")


def test_decode_invalid_token(services):
    assert services.auth.decode_token(None) == (None, False)
    assert services.auth.decode_token("not-a-token") == (None, False)


async def test_decode_expired_token(services, make_user):
    user_id = await make_user()
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.now(timezone.utc) - datetime.timedelta(seconds=1),
    }
    token = jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )

    assert services.auth.decode_token(token) == (user_id, True)


async def test_sync_accepts_newer_client_version(services, make_user):
    user_id = await make_user()

    outcome = await services.todos.sync(
        user_id, {"id": "t1", "text": "new", "updatedAt": 100}
    )

    assert outcome.updated is True
    assert outcome.deleted is False
    assert [todo["text"] for todo in await services.todos.list_todos(user_id)] == [
        "new"
    ]


async def test_sync_keeps_newer_server_version(services, make_user):
    user_id = await make_user()
    await services.todos.sync(
        user_id, {"id": "t1", "text": "server", "updatedAt": 100}
    )

    outcome = await services.todos.sync(
        user_id, {"id": "t1", "text": "client", "updatedAt": 50}
    )

    assert outcome.updated is False
    assert outcome.deleted is False
    assert [todo["text"] for todo in await services.todos.list_todos(user_id)] == [
        "server"
    ]


async def test_sync_reports_tombstone(services, make_user):
    user_id = await make_user()
    await services.todos.delete(user_id, "t1")

    outcome = await services.todos.sync(
        user_id, {"id": "t1", "text": "again", "updatedAt": 999}
    )

    assert outcome.deleted is True
    assert outcome.updated is False


async def test_delete_removes_todo_and_keeps_tombstone(services, db, make_user):
    user_id = await make_user()
    await services.todos.sync(user_id, {"id": "t1", "text": "x", "updatedAt": 1})

    await services.todos.delete(user_id, "t1")

    assert await services.todos.list_todos(user_id) == []
    row = await db.fetch_one(
        "SELECT deleted_at FROM deleted_todos WHERE id = ? AND user_id = ?",
        ("t1", user_id),
    )
    assert row is not None


async def test_bulk_sync_returns_outcome_per_todo(services, make_user):
    user_id = await make_user()
    await services.todos.sync(
        user_id, {"id": "t1", "text": "server", "updatedAt": 100}
    )
    await services.todos.delete(user_id, "t2")

    results = await services.todos.bulk_sync(
        user_id,
        [
            {"id": "t1", "text": "client", "updatedAt": 50},
            {"id": "t2", "text": "deleted", "updatedAt": 200},
            {"id": "t3", "text": "new", "updatedAt": 1},
        ],
    )

    outcomes = {todo["id"]: outcome for todo, outcome in results}
    assert outcomes["t1"].updated is False
    assert outcomes["t2"].deleted is True
    assert outcomes["t3"].updated is True


async def test_reset_by_type_resets_progress(services, make_user):
    user_id = await make_user()
    await services.todos.sync(
        user_id,
        {
            "id": "d1",
            "text": "daily",
            "type": "daily",
            "completed": True,
            "progressNow": 2,
            "updatedAt": 1,
        },
    )

    await services.todos.reset_by_type(user_id, "daily", 500)

    todo = (await services.todos.list_todos(user_id))[0]
    assert todo["completed"] is False
    assert str(todo["progressNow"]) == "0"
    assert todo["updatedAt"] == 500


async def test_history_sync_uses_lww(services, make_user):
    user_id = await make_user()

    assert (
        await services.daily_history.sync(
            user_id, {"date": "2026-01-15", "mood": 2, "updatedAt": 10}
        )
        is True
    )
    assert (
        await services.daily_history.sync(
            user_id, {"date": "2026-01-15", "mood": 1, "updatedAt": 5}
        )
        is False
    )

    entries = await services.daily_history.get_month(user_id, "2026-01")
    assert entries[0]["mood"] == 2


async def test_history_bulk_sync(services, make_user):
    user_id = await make_user()

    results = await services.daily_history.bulk_sync(
        user_id,
        [
            {"date": "2026-01-01", "updatedAt": 1},
            {"date": "2026-01-02", "updatedAt": 2},
        ],
    )

    assert [updated for _, updated in results] == [True, True]
    assert len(await services.daily_history.get_month(user_id, "2026-01")) == 2


async def test_settings_client_newer_applied(services, make_user):
    user_id = await make_user()
    await services.settings.update(user_id, {"theme": "dark", "updatedAt": 10})

    actual, applied = await services.settings.update(
        user_id, {"theme": "light", "updatedAt": 20}
    )

    assert applied is True
    assert actual["theme"] == "light"


async def test_settings_server_newer_wins(services, make_user):
    user_id = await make_user()
    await services.settings.update(user_id, {"theme": "dark", "updatedAt": 10})

    actual, applied = await services.settings.update(
        user_id, {"theme": "light", "updatedAt": 5}
    )

    assert applied is False
    assert actual["theme"] == "dark"


async def test_settings_initialized_when_missing(services, db, make_user):
    user_id = await make_user()
    await db.execute("UPDATE users SET settings = NULL WHERE id = ?", (user_id,))

    actual, applied = await services.settings.update(
        user_id, {"theme": "dark", "updatedAt": 0}
    )

    assert applied is True
    assert actual == {"theme": "dark", "updatedAt": 0}

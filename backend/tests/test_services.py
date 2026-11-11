"""Тесты бизнес-логики сервисов."""

import datetime
import json
from datetime import timezone

import jwt
import pydantic
import pytest

from app.config import settings
from app.schemas import DailyHistory, Todo
from app.schemas.settings import (
    ShortcutSettings,
    UserSettings,
    default_settings,
    normalize_settings,
)
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
    assert result["settings"] == default_settings()
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
    assert outcome.status == "conflict"
    assert outcome.server_todo["text"] == "server"
    assert outcome.server_todo["updatedAt"] == 100
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
    assert outcome.status == "deleted"


async def test_delete_removes_todo_and_keeps_tombstone(services, db, make_user):
    user_id = await make_user()
    await services.todos.sync(user_id, {"id": "t1", "text": "x", "updatedAt": 1})

    deleted_id = await services.todos.delete(user_id, "t1")

    assert deleted_id == "t1"
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

    outcomes = {outcome.todo["id"]: outcome for outcome in results}
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

    _, updated = await services.daily_history.sync(
        user_id, {"date": "2026-01-15", "mood": 2, "updatedAt": 10}
    )
    assert updated is True

    entry, updated = await services.daily_history.sync(
        user_id, {"date": "2026-01-15", "mood": 1, "updatedAt": 5}
    )
    assert updated is False
    assert entry["mood"] == 2

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
        user_id, {"theme": "pink", "updatedAt": 20}
    )

    assert applied is True
    assert actual["theme"] == "pink"


async def test_settings_server_newer_wins(services, make_user):
    user_id = await make_user()
    await services.settings.update(user_id, {"theme": "dark", "updatedAt": 10})

    actual, applied = await services.settings.update(
        user_id, {"theme": "pink", "updatedAt": 5}
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
    assert actual["theme"] == "dark"
    assert set(actual) == set(UserSettings.model_fields)


async def test_settings_get_returns_defaults_when_missing(services, db, make_user):
    user_id = await make_user()
    await db.execute("UPDATE users SET settings = NULL WHERE id = ?", (user_id,))

    assert await services.settings.get(user_id) == default_settings()


async def test_settings_get_returns_stored_contract(services, make_user):
    user_id = await make_user()
    await services.settings.update(user_id, {"theme": "dark", "updatedAt": 10})

    actual = await services.settings.get(user_id)

    assert actual["theme"] == "dark"
    assert actual["updatedAt"] == 10
    assert set(actual) == set(UserSettings.model_fields)


def test_default_settings_cover_full_contract():
    defaults = default_settings()

    assert set(defaults) == set(UserSettings.model_fields)
    assert defaults["shortcuts"] == ShortcutSettings().model_dump()
    assert defaults["updatedAt"] == 0


def test_normalize_settings_merges_partial_and_ignores_unknown():
    normalized = normalize_settings(
        {
            "theme": "dark",
            "unknown_key": 1,
            "shortcuts": {"rpg_tab": "ctrl+9"},
        }
    )

    assert normalized["theme"] == "dark"
    assert "unknown_key" not in normalized
    assert normalized["shortcuts"]["rpg_tab"] == "ctrl+9"
    assert normalized["shortcuts"]["todo_tab"] == "mod+2"


def test_normalize_settings_replaces_invalid_values():
    normalized = normalize_settings(
        {
            "theme": "neon",
            "reset_time": "25:00",
            "timezone": "Mars/Olympus",
            "language": "de",
            "soft_delete": "nope",
            "shortcuts": {"rpg_tab": ""},
        }
    )

    assert normalized == default_settings()


def test_normalize_settings_keeps_valid_timezone():
    normalized = normalize_settings({"timezone": "Asia/Ashgabat"})

    assert normalized["timezone"] == "Asia/Ashgabat"


def test_normalize_settings_accepts_json_string():
    normalized = normalize_settings('{"theme": "pink", "reset_time": "9:5"}')

    assert normalized["theme"] == "pink"
    assert normalized["reset_time"] == "09:05"


def test_normalize_settings_handles_broken_json():
    assert normalize_settings("{not json") == default_settings()


async def test_register_stores_full_default_settings(services, db):
    await services.auth.register("alice", "secret")

    row = await db.fetch_one("SELECT settings FROM users WHERE username = ?", ("alice",))

    assert json.loads(row["settings"]) == default_settings()


async def test_login_migrates_legacy_settings(services, db):
    await services.auth.register("alice", "secret")
    row = await db.fetch_one("SELECT id FROM users WHERE username = ?", ("alice",))
    legacy = {"main_page": "rpg", "theme": "mint", "soft_delete": False}
    await db.execute(
        "UPDATE users SET settings = ? WHERE id = ?", (json.dumps(legacy), row["id"])
    )

    result = await services.auth.login("alice", "secret")

    actual = result["settings"]
    assert actual["main_page"] == "rpg"
    assert actual["theme"] == "mint"
    assert actual["soft_delete"] is False
    assert actual["reset_time"] == "00:00"
    assert actual["shortcuts"]["rpg_tab"] == "mod+1"

    stored = await db.fetch_one("SELECT settings FROM users WHERE id = ?", (row["id"],))
    assert json.loads(stored["settings"]) == actual


async def test_settings_update_stores_full_contract(services, db, make_user):
    user_id = await make_user()

    actual, applied = await services.settings.update(
        user_id, {"theme": "dark", "updatedAt": 10}
    )

    assert applied is True
    assert set(actual) == set(UserSettings.model_fields)
    row = await db.fetch_one(
        "SELECT settings FROM users WHERE id = ?", (user_id,)
    )
    assert json.loads(row["settings"]) == actual


async def test_settings_update_migrates_stored_settings(services, db, make_user):
    user_id = await make_user()
    stored = {"theme": "dark", "updatedAt": 100}
    await db.execute(
        "UPDATE users SET settings = ? WHERE id = ?", (json.dumps(stored), user_id)
    )

    actual, applied = await services.settings.update(
        user_id, {"theme": "pink", "updatedAt": 5}
    )

    assert applied is False
    assert actual["theme"] == "dark"
    assert actual["language"] == "ru"
    row = await db.fetch_one(
        "SELECT settings FROM users WHERE id = ?", (user_id,)
    )
    assert json.loads(row["settings"]) == actual


def test_todo_accepts_tv_show_episode_string():
    todo = Todo.model_validate(
        {"id": "t1", "type": "tv_show", "progressNow": "2-5", "progressEnd": 10}
    )

    assert todo.type == "tv_show"
    assert todo.progressNow == "2-5"


def test_todo_accepts_numeric_progress_strings():
    todo = Todo.model_validate(
        {"id": "t1", "progressNow": "3", "progressEnd": "10", "contribution": -1}
    )

    assert todo.contribution == -1


@pytest.mark.parametrize(
    "payload",
    [
        {"text": "no id"},
        {"id": "", "text": "empty id"},
        {"id": "   ", "text": "blank id"},
        {"id": "t1", "text": "x" * 2001},
        {"id": "t1", "days": "1111111\n"},
        {"id": "t1", "days": "1111111 "},
        {"id": "t1", "progressNow": " 3"},
        {"id": "t1", "type": "unknown"},
        {"id": "t1", "days": "1111"},
        {"id": "t1", "days": "2222222"},
        {"id": "t1", "contribution": -2},
        {"id": "t1", "type": "habit", "contribution": 5},
        {"id": "t1", "updatedAt": -1},
        {"id": "t1", "progressNow": -3},
        {"id": "t1", "progressNow": "abc"},
        {"id": "t1", "progressNow": True},
        {"id": "t1", "type": "tv_show", "progressNow": "s1e2"},
        {"id": "t1", "type": "tv_show", "progressNow": 5},
        {"id": "t1", "type": "tv_show", "progressNow": "1-2\n"},
    ],
)
def test_todo_rejects_garbage(payload):
    with pytest.raises(pydantic.ValidationError):
        Todo.model_validate(payload)


@pytest.mark.parametrize(
    "payload",
    [
        {"date": "2026-1-1"},
        {"date": "2026-02-30"},
        {"date": None},
        {"date": "2026-01-01\n"},
        {"date": " 2026-01-01"},
        {"date": "2026-01-01", "mood": 7},
        {"date": "2026-01-01", "mood": 0},
        {"date": "2026-01-01", "habits_detail": "{broken"},
        {"date": "2026-01-01", "habits_detail": '{"a": 1}'},
        {"date": "2026-01-01", "pos_points": -1},
        {"date": "2026-01-01", "updatedAt": -5},
        {"date": "2026-01-01", "updatedAt": True},
        {"date": "2026-01-01", "mood": True},
    ],
)
def test_history_rejects_garbage(payload):
    with pytest.raises(pydantic.ValidationError):
        DailyHistory.model_validate(payload)


async def test_sync_rejects_garbage_without_writing(services, db, make_user):
    user_id = await make_user()

    with pytest.raises(ValidationError):
        await services.todos.sync(user_id, {"id": "t1", "days": "abc"})

    row = await db.fetch_one(
        "SELECT COUNT(*) AS total FROM todos WHERE user_id = ?", (user_id,)
    )
    assert row["total"] == 0


async def test_bulk_sync_rejects_whole_batch_with_garbage(services, make_user):
    user_id = await make_user()

    with pytest.raises(ValidationError):
        await services.todos.bulk_sync(
            user_id,
            [{"id": "t1"}, {"id": "t2", "type": "habit", "contribution": 9}],
        )

    assert await services.todos.list_todos(user_id) == []


async def test_delete_rejects_invalid_id(services, make_user):
    user_id = await make_user()

    for todo_id in (None, "", "   ", 42, "x" * 65):
        with pytest.raises(ValidationError):
            await services.todos.delete(user_id, todo_id)


async def test_reset_rejects_invalid_payload(services, make_user):
    user_id = await make_user()

    with pytest.raises(ValidationError):
        await services.todos.reset_by_type(user_id, "unknown", 1)
    with pytest.raises(ValidationError):
        await services.todos.reset_by_type(user_id, "daily", "now")


async def test_history_rejects_garbage_and_bad_month(services, make_user):
    user_id = await make_user()

    with pytest.raises(ValidationError):
        await services.daily_history.sync(user_id, {"date": "15.01.2026"})
    with pytest.raises(ValidationError):
        await services.daily_history.get_month(user_id, "2026-13")
    with pytest.raises(ValidationError):
        await services.daily_history.get_month(user_id, "2026-01 ")
    with pytest.raises(ValidationError):
        await services.daily_history.bulk_sync(user_id, {"date": "2026-01-01"})


def test_normalize_settings_is_tolerant_only_for_reset_time():
    normalized = normalize_settings('{"reset_time": " 9:5 ", "language": "en"}')

    assert normalized["reset_time"] == "09:05"
    assert normalized["language"] == "en"


def test_normalize_settings_does_not_strip_other_fields():
    normalized = normalize_settings('{"language": " en"}')

    assert normalized["language"] == "ru"

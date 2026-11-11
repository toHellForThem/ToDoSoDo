"""Тесты слоя доступа к данным."""

from app.rep import (
    DailyHistoryRepository,
    DeletedTodosRepository,
    TodosRepository,
    UsersRepository,
)
from app.schemas import Todo


async def test_users_create_and_fetch(db):
    repo = UsersRepository(db)
    await repo.create("bob", "hash", '{"theme": "dark"}')

    by_name = await repo.get_by_username("bob")
    assert by_name is not None
    assert by_name["password_hash"] == "hash"

    by_id = await repo.get_by_id(by_name["id"])
    assert by_id["username"] == "bob"


async def test_users_get_missing_returns_none(db):
    repo = UsersRepository(db)

    assert await repo.get_by_username("ghost") is None
    assert await repo.get_by_id(404) is None


async def test_users_get_by_username_is_case_insensitive(db):
    repo = UsersRepository(db)
    await repo.create("bob", "hash", "{}")

    user = await repo.get_by_username("BOB")

    assert user is not None
    assert user["username"] == "bob"


async def test_users_update_settings(db):
    repo = UsersRepository(db)
    await repo.create("bob", "hash", "{}")
    user = await repo.get_by_username("bob")

    await repo.update_settings(user["id"], '{"theme": "light"}')

    updated = await repo.get_by_id(user["id"])
    assert updated["settings"] == '{"theme": "light"}'


async def test_todos_upsert_and_list(db, make_user):
    user_id = await make_user()
    repo = TodosRepository(db)

    await repo.upsert(Todo(id="t1", text="first", updatedAt=10), user_id)
    await repo.upsert(Todo(id="t2", text="second", type="daily"), user_id)

    todos = {todo.id: todo for todo in await repo.list_by_user(user_id)}
    assert set(todos) == {"t1", "t2"}
    assert todos["t1"].text == "first"
    assert todos["t2"].type == "daily"


async def test_todos_upsert_replaces_existing(db, make_user):
    user_id = await make_user()
    repo = TodosRepository(db)

    await repo.upsert(Todo(id="t1", text="old", updatedAt=1), user_id)
    await repo.upsert(Todo(id="t1", text="new", updatedAt=2), user_id)

    todos = await repo.list_by_user(user_id)
    assert len(todos) == 1
    assert todos[0].text == "new"
    assert await repo.get_updated_at("t1", user_id) == 2


async def test_todos_are_scoped_by_user(db, make_user):
    first = await make_user("alice")
    second = await make_user("bob")
    repo = TodosRepository(db)

    await repo.upsert(Todo(id="t1", text="alice"), first)
    await repo.upsert(Todo(id="t1", text="bob"), second)

    assert [todo.text for todo in await repo.list_by_user(first)] == ["alice"]
    assert [todo.text for todo in await repo.list_by_user(second)] == ["bob"]


async def test_todos_get_updated_at_missing(db, make_user):
    user_id = await make_user()

    assert await TodosRepository(db).get_updated_at("missing", user_id) is None


async def test_todos_delete(db, make_user):
    user_id = await make_user()
    repo = TodosRepository(db)
    await repo.upsert(Todo(id="t1", text="x"), user_id)

    await repo.delete("t1", user_id)

    assert await repo.list_by_user(user_id) == []


async def test_todos_reset_by_type(db, make_user):
    user_id = await make_user()
    repo = TodosRepository(db)
    await repo.upsert(
        Todo(id="t1", text="daily", type="daily", completed=True, progressNow=3),
        user_id,
    )
    await repo.upsert(
        Todo(id="t2", text="todo", type="todo", completed=True, progressNow=2),
        user_id,
    )

    await repo.reset_by_type(user_id, "daily", 999)

    todos = {todo.id: todo for todo in await repo.list_by_user(user_id)}
    assert todos["t1"].completed is False
    assert str(todos["t1"].progressNow) == "0"
    assert todos["t1"].updatedAt == 999
    assert todos["t2"].completed is True
    assert str(todos["t2"].progressNow) == "2"


async def test_todos_reset_by_type_is_idempotent(db, make_user):
    user_id = await make_user()
    repo = TodosRepository(db)
    await repo.upsert(
        Todo(
            id="t1",
            text="daily",
            type="daily",
            completed=True,
            progressNow=3,
            updatedAt=10,
        ),
        user_id,
    )

    await repo.reset_by_type(user_id, "daily", 999)
    await repo.reset_by_type(user_id, "daily", 999)

    todo = (await repo.list_by_user(user_id))[0]
    assert todo.updatedAt == 999
    assert str(todo.progressNow) == "0"


async def test_todos_reset_by_type_skips_deleted_and_newer(db, make_user):
    user_id = await make_user()
    repo = TodosRepository(db)
    await repo.upsert(
        Todo(
            id="deleted",
            text="daily",
            type="daily",
            completed=True,
            progressNow=3,
            deleted=True,
            updatedAt=10,
        ),
        user_id,
    )
    await repo.upsert(
        Todo(
            id="newer",
            text="daily",
            type="daily",
            completed=True,
            progressNow=4,
            updatedAt=1000,
        ),
        user_id,
    )

    await repo.reset_by_type(user_id, "daily", 999)

    todos = {todo.id: todo for todo in await repo.list_by_user(user_id)}
    assert todos["deleted"].completed is True
    assert str(todos["deleted"].progressNow) == "3"
    assert todos["newer"].completed is True
    assert str(todos["newer"].progressNow) == "4"


async def test_tombstone_add_and_exists(db, make_user):
    user_id = await make_user()
    repo = DeletedTodosRepository(db)

    assert await repo.exists(user_id, "t1") is False

    await repo.add("t1", user_id, 123)
    await repo.add("t1", user_id, 456)

    assert await repo.exists(user_id, "t1") is True


async def test_tombstone_scoped_by_user(db, make_user):
    first = await make_user("alice")
    second = await make_user("bob")
    repo = DeletedTodosRepository(db)

    await repo.add("t1", first, 1)

    assert await repo.exists(second, "t1") is False


async def test_daily_history_month_filter(db, make_user):
    user_id = await make_user()
    repo = DailyHistoryRepository(db)

    await repo.upsert({"date": "2026-01-15", "mood": 2, "updatedAt": 1}, user_id)
    await repo.upsert({"date": "2026-02-01", "mood": 3, "updatedAt": 1}, user_id)

    january = await repo.list_by_month(user_id, "2026-01")

    assert [entry["date"] for entry in january] == ["2026-01-15"]
    assert january[0]["mood"] == 2


async def test_daily_history_upsert_overwrites(db, make_user):
    user_id = await make_user()
    repo = DailyHistoryRepository(db)

    await repo.upsert({"date": "2026-01-15", "mood": 1, "updatedAt": 1}, user_id)
    await repo.upsert({"date": "2026-01-15", "mood": 5, "updatedAt": 2}, user_id)

    entries = await repo.list_by_month(user_id, "2026-01")

    assert len(entries) == 1
    assert entries[0]["mood"] == 5
    assert entries[0]["updatedAt"] == 2
    assert await repo.get_updated_at(user_id, "2026-01-15") == 2


async def test_daily_history_get_updated_at_missing(db, make_user):
    user_id = await make_user()

    assert await DailyHistoryRepository(db).get_updated_at(user_id, "2026-01-01") is None

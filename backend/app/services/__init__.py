"""Сервисы бизнес-логики и composition root."""

from app.config import settings as app_settings
from app.database import Database
from app.rep import (
    DailyHistoryRepository,
    DeletedTodosRepository,
    TodosRepository,
    UsersRepository,
)
from app.services.auth import AuthService
from app.services.daily_history import DailyHistoryService
from app.services.errors import (
    AuthError,
    ConflictError,
    NotFoundError,
    ServiceError,
    ValidationError,
)
from app.services.settings import SettingsService
from app.services.todos import SyncOutcome, TodoService


class Services:
    """Контейнер сервисов, собранных поверх одного подключения к БД."""

    def __init__(self, db: Database) -> None:
        users_repo = UsersRepository(db)
        todos_repo = TodosRepository(db)
        deleted_todos_repo = DeletedTodosRepository(db)
        daily_history_repo = DailyHistoryRepository(db)

        self.auth = AuthService(users_repo)
        self.todos = TodoService(
            todos_repo, deleted_todos_repo, app_settings.tombstone_ttl_days
        )
        self.daily_history = DailyHistoryService(daily_history_repo)
        self.settings = SettingsService(users_repo)


def build_services(db: Database) -> Services:
    """Собирает сервисы для переданного подключения к БД."""
    return Services(db)


__all__ = [
    "AuthError",
    "AuthService",
    "ConflictError",
    "DailyHistoryService",
    "NotFoundError",
    "ServiceError",
    "Services",
    "SettingsService",
    "SyncOutcome",
    "TodoService",
    "ValidationError",
    "build_services",
]

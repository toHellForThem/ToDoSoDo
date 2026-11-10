"""Pydantic-схемы приложения."""

from app.schemas.history import DailyHistory, validate_month
from app.schemas.settings import (
    ShortcutSettings,
    UserSettings,
    default_settings,
    dump_settings,
    normalize_settings,
    normalize_user_settings,
)
from app.schemas.todo import Todo, TodoType, validate_todo_id

__all__ = [
    "DailyHistory",
    "ShortcutSettings",
    "Todo",
    "TodoType",
    "UserSettings",
    "default_settings",
    "dump_settings",
    "normalize_settings",
    "normalize_user_settings",
    "validate_month",
    "validate_todo_id",
]

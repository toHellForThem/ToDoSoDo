"""Pydantic-схемы приложения."""

from app.schemas.settings import (
    ShortcutSettings,
    UserSettings,
    default_settings,
    dump_settings,
    normalize_settings,
    normalize_user_settings,
)
from app.schemas.todo import Todo

__all__ = [
    "ShortcutSettings",
    "Todo",
    "UserSettings",
    "default_settings",
    "dump_settings",
    "normalize_settings",
    "normalize_user_settings",
]

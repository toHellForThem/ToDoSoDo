"""Схемы задач и проверка клиентского payload."""

import re
from enum import Enum
from typing import Annotated, Union

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

DAYS_PATTERN = r"^[01]{7}$"
_PROGRESS_PATTERN = re.compile(r"\d+")
_EPISODE_PATTERN = re.compile(r"\d+-\d+")


class TodoType(str, Enum):
    """Типы задач, которые поддерживает клиент."""

    TODO = "todo"
    DAILY = "daily"
    HABIT = "habit"
    PIGGY_BANK = "piggy_bank"
    TV_SHOW = "tv_show"
    MOVIE = "movie"


def _as_non_negative_int(value: object) -> int | None:
    """Приводит значение к неотрицательному целому или возвращает ``None``."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, str) and _PROGRESS_PATTERN.fullmatch(value):
        return int(value)
    return None


class Todo(BaseModel):
    """Задача в контракте синхронизации."""

    model_config = ConfigDict(use_enum_values=True)

    id: Annotated[str, StringConstraints(min_length=1, max_length=64)]
    text: Annotated[str, StringConstraints(max_length=2000)] = ""
    completed: bool = False
    deleted: bool = False
    updatedAt: int = Field(default=0, ge=0)
    type: TodoType = "todo"
    progressNow: Union[int, str] = 0
    progressEnd: Union[int, str] = 1
    # Для привычек это знак вклада (-1/0/1), для daily — текущий прогресс.
    contribution: int = Field(default=0, ge=-1)
    days: Annotated[str, StringConstraints(pattern=DAYS_PATTERN)] = "1111111"

    @field_validator("id")
    @classmethod
    def _validate_id(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("id задачи не может быть пустым")
        return value

    @field_validator(
        "updatedAt", "contribution", "progressNow", "progressEnd", mode="before"
    )
    @classmethod
    def _reject_booleans(cls, value: object) -> object:
        if isinstance(value, bool):
            raise ValueError("boolean недопустим в числовом поле задачи")
        return value

    @model_validator(mode="after")
    def _validate_progress(self) -> "Todo":
        if self.type == TodoType.HABIT and self.contribution > 1:
            raise ValueError("contribution привычки должен быть -1, 0 или 1")

        if self.type == TodoType.TV_SHOW:
            if not (
                isinstance(self.progressNow, str)
                and _EPISODE_PATTERN.fullmatch(self.progressNow)
            ):
                raise ValueError(
                    "progressNow для tv_show должен быть строкой в формате S-E"
                )
            if _as_non_negative_int(self.progressEnd) is None:
                raise ValueError("progressEnd должен быть неотрицательным целым")
            return self

        if _as_non_negative_int(self.progressNow) is None:
            raise ValueError("progressNow должен быть неотрицательным целым")
        if _as_non_negative_int(self.progressEnd) is None:
            raise ValueError("progressEnd должен быть неотрицательным целым")
        return self


def validate_todo_id(todo_id: object) -> str:
    """Проверяет идентификатор задачи без нормализации значения."""
    if not isinstance(todo_id, str):
        raise ValueError("id задачи должен быть строкой")
    if not todo_id.strip() or len(todo_id) > 64:
        raise ValueError("id задачи должен содержать от 1 до 64 символов")
    return todo_id


__all__ = ["DAYS_PATTERN", "Todo", "TodoType", "validate_todo_id"]

"""Схемы ежедневной истории."""

import datetime
import json
import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
MONTH_PATTERN = re.compile(r"\d{4}-(0[1-9]|1[0-2])")


def validate_month(month: object) -> str:
    """Проверяет месяц в формате ``YYYY-MM`` без нормализации значения."""
    if not isinstance(month, str) or not MONTH_PATTERN.fullmatch(month):
        raise ValueError("month должен быть строкой в формате YYYY-MM")
    return month


class DailyHistory(BaseModel):
    """Запись ежедневной истории в контракте синхронизации."""

    date: str
    mood: int | None = Field(default=None, ge=1, le=5)
    daily_progress: float = Field(default=0.0, ge=0)
    pos_points: int = Field(default=0, ge=0)
    neg_points: int = Field(default=0, ge=0)
    habits_detail: str = "[]"
    updatedAt: int = Field(default=0, ge=0)

    @field_validator(
        "mood", "daily_progress", "pos_points", "neg_points", "updatedAt",
        mode="before",
    )
    @classmethod
    def _reject_booleans(cls, value: Any) -> Any:
        if isinstance(value, bool):
            raise ValueError("boolean недопустим в числовом поле истории")
        return value

    @field_validator("date")
    @classmethod
    def _validate_date(cls, value: str) -> str:
        if not isinstance(value, str) or not DATE_PATTERN.fullmatch(value):
            raise ValueError("date должен быть строкой в формате YYYY-MM-DD")
        try:
            datetime.date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date должен быть существующей датой") from exc
        return value

    @field_validator("habits_detail", mode="before")
    @classmethod
    def _validate_habits_detail(cls, value: Any) -> str:
        if value is None:
            return "[]"
        if isinstance(value, (list, dict)):
            value = json.dumps(value, ensure_ascii=False)
        if not isinstance(value, str):
            raise ValueError("habits_detail должен быть JSON-строкой")
        try:
            parsed = json.loads(value)
        except ValueError as exc:
            raise ValueError("habits_detail содержит некорректный JSON") from exc
        if not isinstance(parsed, list):
            raise ValueError("habits_detail должен содержать JSON-массив")
        return value


__all__ = ["DATE_PATTERN", "MONTH_PATTERN", "DailyHistory", "validate_month"]

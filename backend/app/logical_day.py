"""Единое определение логического дня.

Логический день пользователя начинается в ``reset_time`` в его часовом
поясе, а метка дня — календарная дата начала.  Формально для момента
``now`` логическая дата равна локальной дате момента ``now - reset_time``.

Контракт однозначен и не зависит от устройства: и сервер, и клиенты
используют один и тот же ``timezone`` из ``UserSettings`` и одинаковую
формулу.  В отличие от старой фронтовой эвристики (``reset_time`` до
полудня сдвигал дату назад, после полудня — вперёд), здесь нет ветвления
по часу сброса, поэтому день не «перескакивает» при ``reset_time > 12:00``.
"""

from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TIMEZONE = "UTC"
DEFAULT_RESET_TIME = "00:00"
LOGICAL_DATE_FORMAT = "%Y-%m-%d"

_RESET_TIME_PATTERN = re.compile(r"^(\d{1,2}):(\d{1,2})$")


def normalize_reset_time(value: object) -> str | None:
    """Приводит время сброса к виду ``HH:MM`` или возвращает ``None``.

    Допускается ``"9:5"`` и пробелы по краям.
    """
    if not isinstance(value, str):
        return None
    match = _RESET_TIME_PATTERN.fullmatch(value.strip())
    if not match:
        return None
    hours, minutes = int(match.group(1)), int(match.group(2))
    if not (0 <= hours <= 23 and 0 <= minutes <= 59):
        return None
    return f"{hours:02d}:{minutes:02d}"


def normalize_timezone(value: object) -> str | None:
    """Возвращает каноническое имя IANA-пояса или ``None``."""
    if not isinstance(value, str):
        return None
    name = value.strip()
    if not name:
        return None
    try:
        return ZoneInfo(name).key
    except (ZoneInfoNotFoundError, ValueError):
        return None


def resolve_timezone(name: object) -> ZoneInfo:
    """Возвращает ``ZoneInfo`` по имени, с откатом на UTC."""
    return ZoneInfo(normalize_timezone(name) or DEFAULT_TIMEZONE)


def parse_reset_time(value: object) -> time:
    """Возвращает ``time`` для ``reset_time``, с откатом на ``00:00``."""
    normalized = normalize_reset_time(value) or DEFAULT_RESET_TIME
    hours, minutes = (int(part) for part in normalized.split(":"))
    return time(hour=hours, minute=minutes)


def _as_utc(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        return moment.replace(tzinfo=dt_timezone.utc)
    return moment.astimezone(dt_timezone.utc)


def logical_date(
    moment: datetime,
    reset_time: object = DEFAULT_RESET_TIME,
    timezone_name: object = DEFAULT_TIMEZONE,
) -> date:
    """Логическая дата момента: локальная дата ``moment - reset_time``."""
    zone = resolve_timezone(timezone_name)
    reset = parse_reset_time(reset_time)
    local_moment = _as_utc(moment).astimezone(zone)
    return (local_moment - timedelta(hours=reset.hour, minutes=reset.minute)).date()


def logical_date_str(
    moment: datetime,
    reset_time: object = DEFAULT_RESET_TIME,
    timezone_name: object = DEFAULT_TIMEZONE,
) -> str:
    """Логическая дата в формате ``YYYY-MM-DD``."""
    return logical_date(moment, reset_time, timezone_name).strftime(LOGICAL_DATE_FORMAT)


def logical_day_start(
    moment: datetime,
    reset_time: object = DEFAULT_RESET_TIME,
    timezone_name: object = DEFAULT_TIMEZONE,
) -> datetime:
    """Начало логического дня (локальные дата и время сброса)."""
    zone = resolve_timezone(timezone_name)
    reset = parse_reset_time(reset_time)
    day = logical_date(moment, reset_time, timezone_name)
    return datetime.combine(day, reset, tzinfo=zone)


def next_reset_at(
    moment: datetime,
    reset_time: object = DEFAULT_RESET_TIME,
    timezone_name: object = DEFAULT_TIMEZONE,
) -> datetime:
    """Момент следующего сброса (начало следующего логического дня)."""
    zone = resolve_timezone(timezone_name)
    reset = parse_reset_time(reset_time)
    start = logical_day_start(moment, reset_time, timezone_name)
    next_start = datetime.combine(start.date() + timedelta(days=1), reset, tzinfo=zone)
    # Страховка для несуществующего локального времени в DST-переходе:
    # контракт требует строго будущий момент.
    while next_start <= _as_utc(moment):
        next_start = datetime.combine(next_start.date() + timedelta(days=1), reset, tzinfo=zone)
    return next_start


__all__ = [
    "DEFAULT_RESET_TIME",
    "DEFAULT_TIMEZONE",
    "LOGICAL_DATE_FORMAT",
    "logical_date",
    "logical_date_str",
    "logical_day_start",
    "next_reset_at",
    "normalize_reset_time",
    "normalize_timezone",
    "parse_reset_time",
    "resolve_timezone",
]

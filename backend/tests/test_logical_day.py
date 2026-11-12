"""Тесты единого определения логического дня."""

from datetime import datetime, timezone

import pytest

from app.logical_day import (
    logical_date,
    logical_date_str,
    logical_day_start,
    next_reset_at,
    normalize_reset_time,
    normalize_timezone,
    parse_reset_time,
    resolve_timezone,
)


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("00:00", "00:00"),
        ("4:5", "04:05"),
        (" 23:59 ", "23:59"),
        ("24:00", None),
        ("12:60", None),
        ("", None),
        (None, None),
        (5, None),
    ],
)
def test_normalize_reset_time(value, expected):
    assert normalize_reset_time(value) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("UTC", "UTC"),
        ("Asia/Ashgabat", "Asia/Ashgabat"),
        (" Europe/Berlin ", "Europe/Berlin"),
        ("Mars/Olympus", None),
        ("", None),
        (None, None),
    ],
)
def test_normalize_timezone(value, expected):
    assert normalize_timezone(value) == expected


def test_parse_reset_time_falls_back_to_midnight():
    assert parse_reset_time("bad") == parse_reset_time("00:00")
    assert parse_reset_time("9:5").hour == 9


def test_resolve_timezone_falls_back_to_utc():
    assert resolve_timezone("Mars/Olympus").key == "UTC"


def test_logical_date_depends_on_timezone():
    moment = utc(2026, 11, 10, 21, 57)

    assert logical_date_str(moment, "00:00", "UTC") == "2026-11-10"
    assert logical_date_str(moment, "00:00", "Asia/Ashgabat") == "2026-11-11"


def test_reset_time_moves_date_back_before_reset():
    # 02:57 по Ашхабаду, сброс в 04:00 — ещё вчерашний логический день.
    moment = utc(2026, 11, 10, 21, 57)
    assert logical_date_str(moment, "04:00", "Asia/Ashgabat") == "2026-11-10"


def test_reset_time_after_noon_keeps_start_date():
    # 21:00 по Ашхабаду, сброс в 20:00 — день начался сегодня, а не завтра.
    moment = utc(2026, 11, 10, 16, 0)
    assert logical_date_str(moment, "20:00", "Asia/Ashgabat") == "2026-11-10"


def test_logical_day_start_and_next_reset():
    moment = utc(2026, 11, 10, 21, 57)
    start = logical_day_start(moment, "04:00", "Asia/Ashgabat")
    next_reset = next_reset_at(moment, "04:00", "Asia/Ashgabat")

    assert start.astimezone(timezone.utc) == utc(2026, 11, 9, 23, 0)
    assert next_reset.astimezone(timezone.utc) == utc(2026, 11, 10, 23, 0)


def test_next_reset_across_spring_dst():
    # Europe/Berlin: 29.03.2026 02:00 -> 03:00.
    moment = utc(2026, 3, 28, 12, 0)
    next_reset = next_reset_at(moment, "04:00", "Europe/Berlin")

    assert next_reset.astimezone(timezone.utc) == utc(2026, 3, 29, 2, 0)


def test_next_reset_across_autumn_dst():
    # Europe/Berlin: 25.10.2026 03:00 -> 02:00.
    moment = utc(2026, 10, 24, 12, 0)
    next_reset = next_reset_at(moment, "04:00", "Europe/Berlin")

    assert next_reset.astimezone(timezone.utc) == utc(2026, 10, 25, 3, 0)


def test_naive_moment_is_treated_as_utc():
    naive = datetime(2026, 11, 10, 21, 57)
    assert logical_date(naive, "00:00", "UTC") == logical_date(utc(2026, 11, 10, 21, 57), "00:00", "UTC")

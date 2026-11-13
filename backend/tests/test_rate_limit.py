"""Тесты in-memory rate limiter."""

from app.services.rate_limit import RateLimiter


def test_rate_limiter_blocks_after_limit():
    now = [0.0]
    limiter = RateLimiter(2, 10, clock=lambda: now[0])

    assert limiter.allow("alice") is True
    assert limiter.allow("alice") is True
    assert limiter.allow("alice") is False


def test_rate_limiter_window_expires():
    now = [0.0]
    limiter = RateLimiter(1, 10, clock=lambda: now[0])

    assert limiter.allow("alice") is True
    assert limiter.allow("alice") is False

    now[0] = 11.0
    assert limiter.allow("alice") is True


def test_rate_limiter_reset():
    now = [0.0]
    limiter = RateLimiter(1, 10, clock=lambda: now[0])

    assert limiter.allow("alice") is True
    assert limiter.allow("alice") is False

    limiter.reset("alice")
    assert limiter.allow("alice") is True


def test_rate_limiter_is_per_key():
    now = [0.0]
    limiter = RateLimiter(1, 10, clock=lambda: now[0])

    assert limiter.allow("alice") is True
    assert limiter.allow("bob") is True
    assert limiter.allow("alice") is False

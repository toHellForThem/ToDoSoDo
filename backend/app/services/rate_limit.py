"""Простой in-memory rate limiter для login/register."""

import time
from collections import defaultdict
from typing import Callable


class RateLimiter:
    """Скользящее окно попыток по ключу (например, username)."""

    def __init__(
        self,
        max_attempts: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_attempts = max(1, max_attempts)
        self._window = max(0.0, window_seconds)
        self._clock = clock
        self._attempts: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str) -> bool:
        """Регистрирует попытку и возвращает ``False`` при превышении лимита."""
        now = self._clock()
        attempts = [
            timestamp
            for timestamp in self._attempts.get(key, [])
            if now - timestamp < self._window
        ]
        if len(attempts) >= self._max_attempts:
            self._attempts[key] = attempts
            return False
        attempts.append(now)
        self._attempts[key] = attempts
        return True

    def reset(self, key: str) -> None:
        """Сбрасывает счётчик после успешной попытки."""
        self._attempts.pop(key, None)


__all__ = ["RateLimiter"]

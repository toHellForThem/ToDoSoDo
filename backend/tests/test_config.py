"""Тесты конфигурации приложения."""

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_sio_origins_parses_comma_separated_list():
    config = Settings(
        jwt_secret_key="x",
        sio_cors_origins="http://a, http://b",
        _env_file=None,
    )

    assert config.sio_origins == ["http://a", "http://b"]


def test_sio_origins_allows_star():
    config = Settings(
        jwt_secret_key="x", sio_cors_origins="*", _env_file=None
    )

    assert config.sio_origins == "*"


def test_default_sio_origins_include_tauri():
    config = Settings(jwt_secret_key="x", _env_file=None)

    assert "tauri://localhost" in config.sio_origins
    assert "http://tauri.localhost" in config.sio_origins


def test_jwt_secret_is_required(monkeypatch):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)

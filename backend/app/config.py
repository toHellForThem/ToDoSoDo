from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Обязателен: дефолта в коде нет, значение приходит только из env.
    jwt_secret_key: str
    jwt_algorithm: str = "HS512"
    jwt_expire_days: int = 7

    database_path: str = "data/tasks.db"

    # Сколько дней tombstone блокирует пересоздание задачи с тем же id.
    tombstone_ttl_days: int = 30

    log_level: str = "INFO"

    # In-memory rate limit для login/register.
    auth_rate_limit_attempts: int = 5
    auth_rate_limit_window_seconds: int = 60

    cors_origins: list[str] = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "tauri://localhost",
        "http://tauri.localhost",
    ]

    # Список origin'ов через запятую или "*" для отключения проверки.
    sio_cors_origins: str = (
        "http://localhost:8081,http://127.0.0.1:8081,"
        "tauri://localhost,http://tauri.localhost"
    )

    @property
    def sio_origins(self) -> str | list[str]:
        """Возвращает значение для ``cors_allowed_origins`` Socket.IO."""
        value = self.sio_cors_origins.strip()
        if value == "*":
            return "*"
        return [origin.strip() for origin in value.split(",") if origin.strip()]


settings = Settings()


from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    jwt_secret_key: str
    jwt_algorithm: str = "HS512"
    jwt_expire_days: int = 7

    database_path: str = "data/tasks.db"

    cors_origins: list[str] = ['http://localhost:8081', 'http://127.0.0.1:8081']

    sio_cors_origins: str = "*"

settings = Settings()


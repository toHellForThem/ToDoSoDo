"""Базовый репозиторий: общая зависимость от слоя БД."""

from app.database import Database


class BaseRepository:
    """Хранит ссылку на подключение к базе данных."""

    def __init__(self, db: Database) -> None:
        self._db = db

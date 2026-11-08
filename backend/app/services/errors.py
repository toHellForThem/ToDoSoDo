"""Доменные исключения слоя сервисов."""


class ServiceError(Exception):
    """Базовое исключение бизнес-логики."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class AuthError(ServiceError):
    """Ошибка аутентификации или авторизации."""


class ValidationError(ServiceError):
    """Некорректные входные данные."""


class NotFoundError(ServiceError):
    """Запрошенная сущность не найдена."""


class ConflictError(ServiceError):
    """Конфликт данных, например занятый логин."""

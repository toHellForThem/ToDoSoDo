"""Доменные исключения слоя сервисов."""

from typing import Any, TypeVar

from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError

ModelT = TypeVar("ModelT", bound=BaseModel)


class ServiceError(Exception):
    """Базовое исключение бизнес-логики."""

    code = "error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class AuthError(ServiceError):
    """Ошибка аутентификации или авторизации."""

    code = "auth_error"


class ValidationError(ServiceError):
    """Некорректные входные данные."""

    code = "validation_error"


class NotFoundError(ServiceError):
    """Запрошенная сущность не найдена."""

    code = "not_found"


class ConflictError(ServiceError):
    """Конфликт данных, например занятый логин."""

    code = "conflict"


def format_validation_errors(exc: PydanticValidationError) -> str:
    """Коротко описывает первые ошибки pydantic для клиента."""
    details = []
    for error in exc.errors()[:3]:
        location = ".".join(str(part) for part in error["loc"]) or "payload"
        details.append(f"{location}: {error['msg']}")
    return "; ".join(details)


def validate_payload(model: type[ModelT], data: Any, prefix: str) -> ModelT:
    """Валидирует клиентский payload и превращает ошибку pydantic в доменную."""
    try:
        return model.model_validate(data)
    except PydanticValidationError as exc:
        raise ValidationError(f"{prefix}: {format_validation_errors(exc)}") from exc


__all__ = [
    "AuthError",
    "ConflictError",
    "NotFoundError",
    "ServiceError",
    "ValidationError",
    "format_validation_errors",
    "validate_payload",
]

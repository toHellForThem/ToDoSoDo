"""Полный контракт пользовательских настроек.

Сервер — источник истины по ``UserSettings``. Модели описывают все поля,
которые использует фронтенд, а :func:`normalize_settings` приводит любые
сохранённые или присланные клиентом данные к полному набору с дефолтами.

Политика для неизвестных ключей — игнорировать (``extra="ignore"``):
клиенты могут присылать новые поля раньше, чем сервер их узнает, и это не
должно ломать сохранение настроек.
"""

import json
import logging
import re
from collections.abc import Mapping
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    TypeAdapter,
    field_validator,
)
from pydantic import (
    ValidationError as PydanticValidationError,
)

logger = logging.getLogger(__name__)

RESET_TIME_PATTERN = re.compile(r"^(\d{1,2}):(\d{1,2})$")

MainPage = Literal["todo", "rpg", "daily"]
ThemeName = Literal["default", "dark", "mint", "pink"]
RpgSubtab = Literal["dashboard", "habits", "piggy_bank", "tv_shows"]
Language = Literal["ru", "en"]

ShortcutKey = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
]


class ShortcutSettings(BaseModel):
    """Горячие клавиши рабочего стола как часть контракта настроек."""

    model_config = ConfigDict(extra="ignore")

    rpg_tab: ShortcutKey = "mod+1"
    todo_tab: ShortcutKey = "mod+2"
    daily_tab: ShortcutKey = "mod+3"
    habits_subtab: ShortcutKey = "mod+q"
    piggy_subtab: ShortcutKey = "mod+w"
    tv_subtab: ShortcutKey = "mod+e"
    recycle_view: ShortcutKey = "mod+r"
    settings_view: ShortcutKey = "mod+s"
    calendar_view: ShortcutKey = "mod+c"
    mood_view: ShortcutKey = "mod+x"


def normalize_reset_time(value: Any) -> str | None:
    """Приводит время сброса к виду ``HH:MM`` или возвращает ``None``."""
    if not isinstance(value, str):
        return None
    match = RESET_TIME_PATTERN.match(value.strip())
    if not match:
        return None
    hours, minutes = int(match.group(1)), int(match.group(2))
    if not (0 <= hours <= 23 and 0 <= minutes <= 59):
        return None
    return f"{hours:02d}:{minutes:02d}"


class UserSettings(BaseModel):
    """Полный набор пользовательских настроек с дефолтами."""

    model_config = ConfigDict(extra="ignore")

    main_page: MainPage = "todo"
    theme: ThemeName = "default"
    soft_delete: bool = True
    reset_time: str = "00:00"
    rpg_subtab: RpgSubtab = "dashboard"
    reset_enabled: bool = True
    language: Language = "ru"
    shortcuts: ShortcutSettings = Field(default_factory=ShortcutSettings)
    updatedAt: int = Field(default=0, ge=0)

    @field_validator("reset_time", mode="before")
    @classmethod
    def _validate_reset_time(cls, value: Any) -> str:
        normalized = normalize_reset_time(value)
        if normalized is None:
            raise ValueError("reset_time должен быть строкой в формате HH:MM")
        return normalized


_FIELD_ADAPTERS: dict[str, TypeAdapter[Any]] = {
    name: TypeAdapter(field.annotation)
    for name, field in UserSettings.model_fields.items()
    if name != "reset_time"
}
_SHORTCUT_ADAPTER: TypeAdapter[Any] = TypeAdapter(ShortcutKey)


def _field_default(name: str) -> Any:
    """Возвращает дефолт поля ``UserSettings`` (с учётом фабрик)."""
    return UserSettings.model_fields[name].get_default(call_default_factory=True)


def parse_settings(raw: Any) -> dict[str, Any]:
    """Разбирает настройки из JSON-строки, словаря или ``None`` в mapping."""
    if isinstance(raw, (str, bytes, bytearray)):
        if not raw:
            return {}
        try:
            raw = json.loads(raw)
        except (TypeError, ValueError):
            logger.warning("Не удалось разобрать сохранённые настройки, применяю дефолты")
            return {}
    if not isinstance(raw, Mapping):
        return {}
    return dict(raw)


def normalize_shortcuts(raw: Any) -> dict[str, str]:
    """Дополняет частичный набор горячих клавиш дефолтами."""
    source = parse_settings(raw)
    defaults = ShortcutSettings().model_dump()
    result: dict[str, str] = {}
    for name in ShortcutSettings.model_fields:
        if name not in source:
            result[name] = defaults[name]
            continue
        try:
            result[name] = _SHORTCUT_ADAPTER.validate_python(source[name])
        except PydanticValidationError:
            logger.warning(
                "Некорректная горячая клавиша %s=%r, применяю дефолт", name, source[name]
            )
            result[name] = defaults[name]
    return result


def _validate_field(name: str, value: Any) -> Any:
    """Валидирует одно поле, подменяя некорректное значение дефолтом."""
    if name == "reset_time":
        normalized = normalize_reset_time(value)
        if normalized is not None:
            return normalized
    else:
        try:
            return _FIELD_ADAPTERS[name].validate_python(value)
        except PydanticValidationError:
            pass
    logger.warning("Некорректное значение настройки %s=%r, применяю дефолт", name, value)
    return _field_default(name)


def default_settings() -> dict[str, Any]:
    """Полный набор дефолтных настроек нового пользователя."""
    return UserSettings().model_dump()


def normalize_settings(raw: Any) -> dict[str, Any]:
    """Приводит любые настройки к полному валидному набору с дефолтами."""
    source = parse_settings(raw)
    normalized = default_settings()
    for name in UserSettings.model_fields:
        if name == "shortcuts":
            normalized["shortcuts"] = normalize_shortcuts(source.get("shortcuts"))
        elif name in source:
            normalized[name] = _validate_field(name, source[name])
    return normalized


def normalize_user_settings(raw: Any) -> tuple[dict[str, Any], bool]:
    """Возвращает настройки и признак того, что исходные данные изменились."""
    source = parse_settings(raw)
    normalized = normalize_settings(source)
    return normalized, source != normalized


def dump_settings(settings_dict: Mapping[str, Any]) -> str:
    """Сериализует настройки для хранения в SQLite."""
    return json.dumps(dict(settings_dict), ensure_ascii=False)


__all__ = [
    "ShortcutSettings",
    "UserSettings",
    "default_settings",
    "dump_settings",
    "normalize_reset_time",
    "normalize_settings",
    "normalize_shortcuts",
    "normalize_user_settings",
    "parse_settings",
]

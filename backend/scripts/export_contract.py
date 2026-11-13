"""Экспорт контракта для фронтенда: JSON Schema и имена событий.

Запуск:
    python scripts/export_contract.py
    python scripts/export_contract.py --check
"""

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.events.names import ClientEvent, ServerEvent  # noqa: E402
from app.events.protocol import AckStatus  # noqa: E402
from app.schemas import DailyHistory, Todo  # noqa: E402
from app.schemas.settings import UserSettings  # noqa: E402

CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts"


def _event_names(cls: type) -> dict[str, str]:
    return {
        name: getattr(cls, name)
        for name in dir(cls)
        if name.isupper() and not name.startswith("_")
    }


def build_contracts() -> dict[str, Any]:
    """Собирает все артефакты контракта в памяти."""
    return {
        "todo.schema.json": Todo.model_json_schema(),
        "daily_history.schema.json": DailyHistory.model_json_schema(),
        "user_settings.schema.json": UserSettings.model_json_schema(),
        "events.json": {
            "client_events": _event_names(ClientEvent),
            "server_events": _event_names(ServerEvent),
            "ack_statuses": [
                AckStatus.APPLIED,
                AckStatus.CONFLICT,
                AckStatus.DELETED,
                AckStatus.REJECTED,
                AckStatus.PROCESSED,
            ],
        },
    }


def serialize_contract(content: Any) -> str:
    """Стабильная сериализация, чтобы diff не шумел."""
    return json.dumps(content, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> int:
    check = "--check" in sys.argv[1:]
    CONTRACTS_DIR.mkdir(parents=True, exist_ok=True)
    stale: list[str] = []

    for name, content in build_contracts().items():
        path = CONTRACTS_DIR / name
        serialized = serialize_contract(content)
        if check:
            if not path.exists() or path.read_text(encoding="utf-8") != serialized:
                stale.append(name)
        else:
            path.write_text(serialized, encoding="utf-8")

    if stale:
        print("Контракт устарел: " + ", ".join(stale))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

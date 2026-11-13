# Экспорт контракта для фронтенда

Контракт генерируется из Pydantic-схем и имён socket-событий:

```bash
cd backend
python scripts/export_contract.py
```

Файлы в `backend/contracts/`:

- `todo.schema.json` — JSON Schema задачи;
- `daily_history.schema.json` — JSON Schema записи истории;
- `user_settings.schema.json` — JSON Schema полного `UserSettings`;
- `events.json` — имена `client:*`/`server:*` событий и статусы `server:ack`.

## Проверка в CI

```bash
python scripts/export_contract.py --check
```

Если схема изменилась, а файлы не перегенерированы, шаг падает. Это
защищает фронт от рассинхронизации с бэкендом.

## Использование на фронте

- JSON Schema можно подключить к валидации payload'ов или генерации типов.
- `events.json` — единый список имён событий и статусов `ack`, чтобы не
  хардкодить строки в клиенте.

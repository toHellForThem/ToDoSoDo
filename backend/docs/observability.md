# Health, логи и наблюдаемость

## HTTP-эндпоинты

- `GET /health` — проверяет приложение и БД (`SELECT 1`).
  - `200 {"status": "ok", "database": "ok"}`
  - `503 {"status": "error", "database": "error"}` при недоступной БД.
- `GET /version` — `{"version": "1.0.2"}` из `APP_VERSION`.

Docker Compose использует `/health` как healthcheck.

## Логи

Формат строк:

```text
Событие client:sync_todo: user_id=1 sid=abc
ack event=client:sync_todo request_id=uuid status=applied
error event=client:sync_todo code=validation_error request_id=uuid
```

- `user_id` и имя события пишет `authenticated`.
- `request_id` и результат (`status`/`code`) пишут `emit_ack`/`emit_error`.
- Пароли и токены не логируются.
- Уровень задаётся `LOG_LEVEL`.

## Коды ошибок

`server:error` всегда содержит машиночитаемый `code`:

- `validation_error` — некорректный payload;
- `auth_error` — ошибка входа;
- `not_found` — сущность не найдена;
- `conflict` — конфликт данных;
- `unauthorized` — событие без авторизации;
- `internal_error` — необработанная ошибка.

Фронт не должен парсить русский текст `message` — только `code`.

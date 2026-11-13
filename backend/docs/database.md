# База данных, миграции и backup

## Файлы

- Основной файл: `DATABASE_PATH` (по умолчанию `data/tasks.db`).
- В режиме WAL рядом появляются `tasks.db-wal` и `tasks.db-shm`.
- Схема версионируется Alembic; версия хранится в таблице
  `alembic_version`.

## Миграции

- При старте сервера `Database.init_schema()` выполняет
  `alembic upgrade head`.
- Вручную из `backend/`:

```bash
alembic upgrade head
alembic current
alembic history
```

- Baseline-миграция `0001_baseline` идемпотентна: создаёт недостающие
  таблицы, колонки и индексы, не удаляя данные.
- Новые изменения схемы добавляются отдельными миграциями в
  `backend/alembic/versions/`.

## Индексы

- `ix_todos_user_id` — выборка задач пользователя.
- `ix_daily_history_user_date` — история за месяц/день.
- `ix_deleted_todos_user_id` — проверка tombstones.

## Транзакции

- `Database.transaction()` — единая транзакция: коммит на выходе,
  откат при исключении.
- `bulk_sync` задач и истории выполняется одной транзакцией, а не
  коммитом на каждую запись.
- `PRAGMA busy_timeout = 5000` и `journal_mode=WAL` включаются при
  подключении.

## Backup

Остановить сервер и скопировать файл (включая `-wal`/`-shm`, если они
есть), либо сделать согласованный backup через SQLite:

```bash
sqlite3 data/tasks.db ".backup 'data/backup-$(date +%F).db'"
```

Для горячего backup без остановки сервера используйте `.backup` —
он учитывает WAL.

## Restore

1. Остановить сервер.
2. Заменить `data/tasks.db` резервной копией.
3. Удалить старые `tasks.db-wal` и `tasks.db-shm`, если они остались.
4. Запустить сервер — миграции применятся автоматически.

## Повреждение файла

```bash
sqlite3 data/tasks.db "PRAGMA integrity_check;"
```

- `ok` — база цела.
- Иначе восстановить из последней резервной копии.
- Если backup нет, можно попробовать `sqlite3 data/tasks.db ".recover"`
  в отдельный файл и затем заменить базу.

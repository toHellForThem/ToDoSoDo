# Протокол синхронизации

Сервер — источник истины. Клиент присылает изменения, сервер отвечает
явным `server:ack` или `server:error`, а при конфликте возвращает
актуальную серверную версию. `server:ack` отправляется только на
мутирующие события; read-события отвечают своим обычным событием.

## Конверт запроса

Любое мутирующее событие можно отправить в конверте:

```json
{
  "request_id": "uuid-клиента",
  "payload": { "...": "старый payload события" }
}
```

`request_id` необязателен. Старый формат (голый payload) поддерживается:
тогда `request_id` в ответе будет `null`. Для событий с несколькими
позиционными аргументами (`client:confirm_reset`) `payload` — массив
`[type, updatedAt]` или объект `{"type": ..., "updatedAt": ...}`.

## `server:ack`

```json
{
  "request_id": "uuid-клиента",
  "event": "client:sync_todo",
  "status": "applied",
  "data": { "...": "каноничная версия" }
}
```

| `status`    | Значение                                                       |
|-------------|----------------------------------------------------------------|
| `applied`   | Изменение клиента применено, `data` — сохранённая версия.      |
| `conflict`  | На сервере новее, `data` — актуальная серверная версия.        |
| `deleted`   | Задача удалена (tombstone), повторное создание запрещено.       |
| `rejected`  | Изменение отклонено (например, некорректный payload).          |
| `processed` | Batch обработан, детали в `data.results`.                      |

`server:ack` отправляется на `client:sync_todo`, `client:delete_todo`,
`client:update_settings`, `client:sync_daily_history`,
`client:confirm_reset`, `client:bulk_sync_todos`,
`client:bulk_delete_todos` и `client:bulk_sync_daily_history`.
На `client:get_todos`, `client:get_month_history` и `client:get_state`
ack не отправляется.

Для bulk-событий верхний `status` — `processed`, а `data.results`
содержит статус каждого элемента:

```json
{
  "status": "processed",
  "results": [
    {"id": "t1", "status": "conflict", "todo": {"...": "серверная версия"}},
    {"id": "t2", "status": "applied", "todo": {"...": "клиентская версия"}}
  ]
}
```

## `server:error`

```json
{
  "code": "validation_error",
  "message": "Некорректная задача: ...",
  "request_id": "uuid-клиента",
  "event": "client:sync_todo"
}
```

Коды: `validation_error`, `auth_error`, `not_found`, `conflict`,
`unauthorized`, `internal_error`.

## Конфликты

Разрешение по `updatedAt` (last-write-wins):

* клиентская версия новее — применяется, `status = applied`;
* серверная версия новее или равна — не применяется, `status = conflict`,
  серверная версия приходит только в `data` (без дублирующего события);
* задача в tombstone — `status = deleted`, `data = {"id": ...}`.

## Tombstones и офлайн-удаление

Tombstone живёт `TOMBSTONE_TTL_DAYS` (по умолчанию 30 дней) и всё это
время блокирует пересоздание задачи с тем же `id`. Просроченные
tombstones удаляются при старте сервера.

Клиент, удаливший задачи офлайн, при подключении отправляет накопленные
tombstones отдельным событием:

```json
{
  "request_id": "uuid",
  "payload": [
    {"id": "t1", "deletedAt": 1760000000000},
    {"id": "t2", "deletedAt": 1760000001000}
  ]
}
```

Событие: `client:bulk_delete_todos`. Ответ — `server:ack` со статусом
`processed` и `data.results` по каждому `id`; другим сессиям уходит
`server:todo_deleted`. В `client:bulk_sync_todos` tombstones не
передаются — это отдельный контракт.

## Первичная загрузка: `client:get_state`

```json
{"request_id": "uuid", "payload": "2026-11"}
```

`payload` — необязательный месяц истории. Ответ `server:state`:

```json
{
  "request_id": "uuid",
  "todos": [],
  "settings": {"...": "полный UserSettings"},
  "history": {"month": "2026-11", "entries": []}
}
```

## Переподключение и токен

* без токена — локальный режим, сервер не отправляет событий;
* истёкший, некорректный токен или удалённый пользователь —
  `server:auth_expired`, клиент очищает сессию и просит войти заново;
* валидный токен — сессия, комната пользователя и `server:login_success`;
  после него клиент повторно синхронизирует состояние
  (`client:get_state` или bulk-события).

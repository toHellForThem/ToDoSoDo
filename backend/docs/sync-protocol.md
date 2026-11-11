# Протокол синхронизации

Сервер — источник истины. Клиент присылает изменения, сервер отвечает
явным `server:ack` или `server:error`, а при конфликте возвращает
актуальную серверную версию.

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

| `status`   | Значение                                                        |
|------------|-----------------------------------------------------------------|
| `applied`  | Изменение клиента применено, `data` — сохранённая версия.       |
| `conflict` | На сервере новее, `data` — актуальная серверная версия.         |
| `deleted`  | Задача удалена (tombstone), повторное создание запрещено.        |
| `rejected` | Изменение отклонено (например, некорректный payload).           |

`server:ack` отправляется на `client:sync_todo`, `client:delete_todo`,
`client:update_settings`, `client:sync_daily_history`,
`client:confirm_reset`, `client:bulk_sync_todos` и
`client:bulk_sync_daily_history`.

Для bulk-событий `data.results` содержит статус каждого элемента:

```json
{
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
  в `data` приходит серверная версия, а в `server:todo_updated` —
  обновление для запросившего клиента;
* задача в tombstone — `status = deleted`.

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

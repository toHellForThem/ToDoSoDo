# Миграция данных Electron → Tauri

Задача: [#46](https://github.com/toHellForThem/ToDoSoDo/issues/46) (эпик
[#57](https://github.com/toHellForThem/ToDoSoDo/issues/57)).

## Что переносится

Локальные данные приложения — ключи `localStorage` (см.
[`frontend/src/utils/storage.ts`](../../frontend/src/utils/storage.ts)):

| Ключ | Содержимое | Переносится |
| --- | --- | --- |
| `username` | логин | да |
| `user_settings` | тема, язык, сброс, шорткаты | да |
| `server_url` | адрес API | да |
| `todo_list` | задачи | да |
| `rpg_history` | история RPG | да |
| `sync_outbox` | очередь неотправленных операций | да |
| `todo_tombstones` | метки жёстких удалений | да |
| `user_token` | JWT сессии | **нет** |

`user_token` — JWT с ограниченным сроком жизни. Переносить его между
установками бессмысленно: после импорта пользователь входит заново, а старый
токен всё равно истечёт. Поэтому токен не попадает в файл экспорта и
игнорируется при импорте.

## Почему данные не переезжают сами

Electron и Tauri хранят `localStorage` в разных профилях и под разными origin:

- Electron: `%APPDATA%/ToDoSoDo` (Chromium profile, origin `app://`);
- Tauri: `%LOCALAPPDATA%/com.todosodo.desktop.tauri` (WebView2 user data).

Автоматического переноса нет — нужен явный экспорт/импорт.

## Способ 1: экспорт и импорт JSON (рекомендуемый)

1. Запустить Electron-версию.
2. Настройки → «Перенос данных» → **«Экспорт данных»**.
   Сохранится файл `todosodo-backup-YYYY-MM-DD.json`.
3. Установить Tauri-версию. Благодаря отдельному `identifier`
   (`com.todosodo.desktop.tauri`) она ставится рядом и не перезаписывает
   Electron-установку.
4. В Tauri-версии: Настройки → «Перенос данных» → **«Импорт данных»**,
   выбрать сохранённый файл.
5. Приложение перезагрузится. Войти заново — токен не переносится.
6. Проверить задачи, настройки, историю RPG и адрес сервера.

Импорт перезаписывает только те ключи, которые есть в файле; остальные
локальные значения не трогаются.

## Способ 2: ручной экспорт через DevTools

Если кнопка экспорта недоступна (например, старая сборка), можно выгрузить
данные вручную.

1. В Electron открыть DevTools (`Ctrl+Shift+I`) → Console.
2. Выполнить:

```js
copy(
  JSON.stringify(
    {
      format: 'todosodo-local-data',
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'electron',
      data: Object.fromEntries(
        [
          'username',
          'user_settings',
          'server_url',
          'todo_list',
          'rpg_history',
          'sync_outbox',
          'todo_tombstones',
        ]
          .map(key => [key, localStorage.getItem(key)])
          .filter(([, value]) => value !== null),
      ),
    },
    null,
    2,
  ),
);
```

3. Вставить содержимое буфера в файл `todosodo-backup.json`.
4. Импортировать файл в Tauri-версии через кнопку «Импорт данных».

Чтение `Local Storage/leveldb` напрямую не рекомендуется: это внутренний
формат Chromium, он меняется между версиями.

## Проверка на тестовом профиле

- [ ] Экспорт из Electron создаёт JSON с ожидаемыми ключами.
- [ ] Импорт в Tauri проходит без ошибок.
- [ ] Задачи, настройки, история RPG и `server_url` на месте.
- [ ] Повторный вход под тем же пользователем работает.
- [ ] Electron-версия запускается рядом с Tauri и видит свои данные.

## Rollback

- `identifier` Tauri (`com.todosodo.desktop.tauri`) отличается от Electron
  `appId` (`com.todosodo.desktop`), поэтому NSIS-установщик Tauri не
  перезаписывает Electron-версию.
- Чтобы откатиться, достаточно удалить Tauri-версию и запустить Electron:
  данные Electron остались в `%APPDATA%/ToDoSoDo`.
- Данные Tauri лежат отдельно в `%LOCALAPPDATA%/com.todosodo.desktop.tauri`
  и удаляются вместе с профилем Tauri.

## Ограничения

- `user_token` не переносится — после импорта нужен повторный вход.
- `sync_outbox` переносится как есть; операции досылаются после входа под тем
  же пользователем.
- Формат файла версионирован (`format: "todosodo-local-data"`, `version: 1`).
  Файлы с неизвестной версией или повреждёнными JSON-значениями отклоняются.

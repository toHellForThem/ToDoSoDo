# Паритет Tauri с Electron

Задача: [#45](https://github.com/toHellForThem/ToDoSoDo/issues/45) (эпик
[#57](https://github.com/toHellForThem/ToDoSoDo/issues/57)).

Источник истины — [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json),
[`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json)
и [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs). Регресс-тест
[`frontend/e2e/tauri-parity.spec.ts`](../../frontend/e2e/tauri-parity.spec.ts)
читает их напрямую.

## Окно и меню

| Параметр | Electron (удалён) | Tauri |
| --- | --- | --- |
| Размер | 1100×750 | `width: 1100`, `height: 750` |
| Заголовок | `ToDoSoDo` | `title: "ToDoSoDo"` |
| Центрирование | `center: true` | `center: true` |
| Меню | `Menu.setApplicationMenu(null)` | меню не создаётся: Tauri не добавляет его по умолчанию |

`activate`/`window-all-closed` не переносим: это macOS-специфика, а закрытие
единственного окна Tauri завершает приложение само.

## Внешние ссылки

В Electron `Linking.openURL` уходил в `shell.openExternal`. В Tauri webview
`window.open` блокируется, а `location.assign` увёл бы приложение с локальной
статики, поэтому donate-ссылка открывается через `tauri-plugin-opener`:

- Rust: `tauri-plugin-opener = "2"` в `Cargo.toml`, `.plugin(tauri_plugin_opener::init())` в `lib.rs`;
- capabilities: `opener:default` для окна `main` (разрешает `open_url` для `https`/`mailto`/`tel`);
- фронтенд: в [`openExternalUrl`](../../frontend/src/platform/linking.ts) ветка `getIsTauri()` лениво импортирует `@tauri-apps/plugin-opener` и вызывает `openUrl`.

Ленивый импорт держит плагин в отдельном web-чанке: мобильные и браузерные
сборки его не загружают.

## Node-API и IPC

Проверено поиском по `frontend/src` и `frontend/App.tsx`:

- `NativeModules` — только в ветках `isIOS`/`isAndroid` (`platform/storage.ts`);
- `react-native-mmkv` — создаётся лениво в `getNativeStorage()`, на web не вызывается;
- `requireNativeModule`/`TurboModule`/`NativeEventEmitter` — не используются;
- Tauri IPC — только `__TAURI_INTERNALS__` в `detectTauri()` и `invoke` внутри `@tauri-apps/plugin-opener`.

На web-сборке нативных вызовов нет.

## Шорткаты `Ctrl+1/2/3`

Логика в [`commands/keys.ts`](../../frontend/src/commands/keys.ts) опирается на
`event.code` (`Digit1`…`Digit3`) и `event.ctrlKey`, без привязки к ОС. На Linux
подтверждено в spike. Проверка на WebView2 (Windows) перенесена в задачу
[#48](https://github.com/toHellForThem/ToDoSoDo/issues/48): локальная машина —
Linux, реальный WebView2 даёт `windows-latest` в CI.

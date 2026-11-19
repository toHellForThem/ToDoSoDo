# Spike Tauri v2 — go/no-go

Задача: [#42](https://github.com/toHellForThem/ToDoSoDo/issues/42) (эпик
[#57](https://github.com/toHellForThem/ToDoSoDo/issues/57)).

## Ответ

**GO.** Tauri v2 заменяет Electron без переписывания приложения.

**Платформы: Windows (основная) + Linux (AppImage).** macOS не добавляем —
её не было и в Electron-сборке.

## Что проверено

Стенд: `rust:1.98-bookworm` в Docker + `libwebkit2gtk-4.1-dev` + Xvfb,
приложение собрано из `frontend/dist` (сборка `expo export`), бэкенд —
живой dev-сервер на `127.0.0.1:8000`. Версии: `tauri` 2.12.5, `wry` 0.57.2,
WebKitGTK 2.50.6, CLI `@tauri-apps/cli` 2.12.4.

| Пункт | Результат | Артефакт |
| --- | --- | --- |
| Сборка оболочки | `cargo build --release --features custom-protocol` — 2 мин 20 с, бинарник 11 МБ | [`docker/linux-verify.Dockerfile`](../docker/linux-verify.Dockerfile) |
| Загрузка `frontend/dist` | UI, вёрстка, иконки и шрифты отрисованы | [`spike/screenshot.png`](spike/screenshot.png) |
| Socket.io → LAN по `http` | соединение `ESTAB` от `WebKitNetworkProcess` к `127.0.0.1:8000` (websocket) | [`spike/sockets.txt`](spike/sockets.txt) |
| Mixed content | не блокируется: страница живёт на `tauri://localhost`, а не `https://` | — |
| `localStorage` | задача переживает перезапуск приложения | [`spike/restart.png`](spike/restart.png) |
| Ввод и клавиатура | ввод задачи + `Enter` добавляют элемент | [`spike/task-added.png`](spike/task-added.png) |
| Календарь | модалка открывается и рендерится | [`spike/calendar.png`](spike/calendar.png) |
| Шорткаты `Ctrl+1/2/3` | переключают вкладки RPG / To Do / Daily | — |
| Reanimated (web) | анимации модалок и layout-переходы работают | косвенно, п. «Календарь» |
| Свайпы мышью | **не подтверждены** автоматизацией `xdotool` | требует ручной проверки |

## Найденные проблемы

1. **CSP ломает `react-native-web`.** С Tauri-модификацией asset-CSP
   `'unsafe-inline'` в `style-src` заменяется на nonce, и динамически
   вставленный stylesheet `react-native-web` блокируется: приложение
   отрисовывается без CSS, иконки — квадратами. Решение в конфиге:
   `dangerousDisableAssetCspModification: true` (CSS-инъекции rn-web
   несовместимы с nonce-моделью). Если позже понадобится строгий CSP —
   генерировать `style-src` с хешами на этапе сборки.
2. **Linux-сборка требует системных dev-пакетов.** На машине разработчика
   (Gentoo без `net-libs/webkit-gtk:4.1`) `cargo check` падает на
   `javascriptcoregtk-4.1`. Сборка Linux вынесена в Docker; в CI нужен тот
   же набор apt-пакетов.
3. **Linux в рантайме требует `webkit2gtk-4.1`.** В отличие от Electron,
   AppImage не приносит движок с собой: на целевой системе должен быть
   установлен `libwebkit2gtk-4.1-0` (в Ubuntu/Debian ставится из репозитория).
   Это регресс по «поставил и работает» — учесть в релизном чек-листе.
4. **Смена origin для `localStorage`.** Было `app://`, станет
   `tauri://localhost` (Linux) / `http://tauri.localhost` (Windows). Данные
   Electron-пользователей сами не переедут — нужна миграция (задача 3.5).
5. **`cargo build` без CLI.** При прямой сборке обязательна фича
   `custom-protocol`, иначе webview показывает страницу ошибки WebKit
   «Operation was cancelled», а не приложение. `tauri build/dev` включают её
   сами.
6. **Свайпы.** Автоматический drag через X11 не открывает действия строки;
   проверить вручную на Windows (мышью) и на тач-экране. Поведение общее с
   Electron (общий web-код), поэтому риск невелик.

## Что переносится без изменений

- `desktop/copy-fonts.js` и ttf-маршрутизация в
  [`desktop/main.js`](../../desktop/main.js:68) не нужны: шрифты в
  `dist/assets/node_modules/...` отдаются asset-протоколом по реальным путям.
- `app://`-протокол и `Menu.setApplicationMenu(null)` не нужны: Tauri не
  создаёт меню по умолчанию.
- `process.env.EXPO_PUBLIC_SOCKET_URL` и переключение `server_url` в рантайме
  работают как раньше; CORS бэкенда (`SIO_CORS_ORIGINS=*`) менять не нужно
  для websocket-транспорта.

## Влияние на следующие задачи эпика

- **3.2** — взять scaffold из этой ветки, добавить `beforeBuildCommand`.
- **3.3** — зафиксировать CSP из конфига + пункт 1 выше.
- **3.4** — окно 1100×750, без меню; devtools: `Ctrl+Shift+I` в dev-сборке.
- **3.5** — миграция `app://` → Tauri-origin (п. 4).
- **3.7** — Docker-сборка Linux переносится в CI as-is.

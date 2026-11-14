# CSP и сеть в Tauri

Источник истины — [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json)
(`app.security.csp`). Регресс-тест читает CSP оттуда же, поэтому расхождение
конфига и теста невозможно.

## Почему `dangerousDisableAssetCspModification: true`

Tauri по умолчанию заменяет `'unsafe-inline'` в `style-src` на nonce.
`react-native-web` вставляет таблицу стилей инлайновым `<style>`, nonce ей не
выдаётся — приложение остаётся без CSS и шрифтов. Флаг отключает эту подмену.
Если понадобится строгий CSP, `style-src` нужно собирать с хешами на этапе
сборки, а не возвращать nonce-модель.

## CORS бэкенда

`tauri://localhost` в `SIO_CORS_ORIGINS` добавлять не нужно: транспорт —
только `websocket`, CORS в нём не участвует, а нестандартную схему сервер
всё равно не провалидирует. Пересмотреть, только если вернётся HTTP-polling.

## Будущие медиа

Сейчас `media-src 'self' blob:`, `worker-src` не задан (fallback на
`default-src 'self'`). При появлении обложек, видео или `hls.js` расширить
`img-src`, `media-src`, `worker-src` и `connect-src` — и добавить проверку в
регресс-тест.

## Регресс-тест

```sh
cd frontend
npm run e2e:build   # dist с любым EXPO_PUBLIC_SOCKET_URL
npm run e2e:csp
```

Тест поднимает статику с CSP из конфига и открывает её в Chromium с
`--host-resolver-rules="MAP tauri.localhost 127.0.0.1"` — origin совпадает с
WebView2 на Windows. Падает на:

- `securitypolicyviolation` и console-ошибках CSP;
- отсутствии инлайновых стилей (`todosodo-web-global-styles`, `user-select`);
- незагруженных шрифтах иконок (`document.fonts`);
- расхождении конфига: `dangerousDisableAssetCspModification` выключен или
  `style-src` без `'unsafe-inline'`.

## Windows

Проверки login, sync, reconnect и смены сервера на WebView2 (origin
`http://tauri.localhost`) перенесены в задачу
[#48](https://github.com/toHellForThem/ToDoSoDo/issues/48) (CI для Tauri):
локальная машина — Linux, а `windows-latest` в CI даёт реальный WebView2.

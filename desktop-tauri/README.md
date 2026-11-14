# ToDoSoDo — оболочка Tauri v2

Spike-оболочка для замены Electron ([`desktop/`](../desktop)). Приложение не
переписывается: Tauri грузит тот же web-бандл `frontend/dist`, что и
Electron-оболочка.

## Что внутри

| Файл | Назначение |
| --- | --- |
| [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) | окно 1100×750, `frontendDist`, CSP |
| [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) | `tauri::Builder` без плагинов |
| [`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json) | права окна — только `core:default` |
| [`scripts/build-frontend.mjs`](scripts/build-frontend.mjs) | `expo export --platform web` с `EXPO_PUBLIC_SOCKET_URL` |
| [`docker/linux-verify.Dockerfile`](docker/linux-verify.Dockerfile) | сборка под Linux в Debian-контейнере |
| [`docker/verify-run.sh`](docker/verify-run.sh) | запуск бинарника в Xvfb + скриншот + снимок сокетов |

## Требования

- **Rust** ≥ 1.77.2 и **Node** ≥ 20 (для `@tauri-apps/cli`).
- **Windows**: WebView2 (есть в Windows 10/11 по умолчанию).
- **Linux**: `webkit2gtk-4.1`, `libgtk-3-dev`, `librsvg2-dev` (в Gentoo —
  `net-libs/webkit-gtk:4.1`). Без них `cargo check` падает на
  `javascriptcore-rs-sys`.

## Сборка

```sh
# 1. фронтенд в frontend/dist (адрес сервера можно переопределить)
cd desktop-tauri
TAURI_SOCKET_URL=http://192.168.1.50:8000 npm run frontend:build

# 2. оболочка
npm install
npm run dev      # dev-сервер Expo на :8081
npm run build    # NSIS (Windows) / AppImage + deb (Linux)
```

Сырой `cargo build --release` без CLI собирается только с фичей
`custom-protocol`, иначе `frontendDist` не вшивается и webview показывает
ошибку WebKit:

```sh
cargo build --release --features custom-protocol \
  --manifest-path src-tauri/Cargo.toml
```

## Проверка под Linux без установки webkit-пакетов

```sh
docker build -f docker/linux-verify.Dockerfile -t todosodo-tauri-linux ..
mkdir -p docs/spike
docker run --rm --privileged --network host \
  -e PROBE_INPUT=1 \
  -v "$PWD/docker/verify-run.sh:/verify-run.sh:ro" \
  -v "$PWD/docs/spike:/out" \
  todosodo-tauri-linux bash /verify-run.sh
```

`--privileged` нужен для sandbox WebKit (bwrap), `--network host` — чтобы
webview достучался до бэкенда на `127.0.0.1:8000`.

## Особенности

- **CSP**: в [`tauri.conf.json`](src-tauri/tauri.conf.json) включён
  `dangerousDisableAssetCspModification`. Без него Tauri подменяет
  `'unsafe-inline'` в `style-src` на nonce, и `react-native-web` не может
  вставить свою таблицу стилей — приложение рендерится без CSS и шрифтов.
- **Шрифты** иконок лежат в `dist/assets/node_modules/...` и отдаются
  asset-протоколом по реальным путям: `copy-fonts.js` и переписывание `.ttf`
  из Electron-оболочки не нужны.
- **Локальные данные**: origin в Tauri — `tauri://localhost` (Linux) и
  `http://tauri.localhost` (Windows), а в Electron был `app://`. Перенос
  `localStorage` — отдельная задача миграции.
- **Меню**: Tauri не создаёт нативное меню по умолчанию — паритет с
  `Menu.setApplicationMenu(null)` в Electron достигнут без кода.

Результаты спайка — в [`docs/spike-report.md`](docs/spike-report.md).

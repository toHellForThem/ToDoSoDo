# Пакетирование и релиз Tauri

Задача: [#47](https://github.com/toHellForThem/ToDoSoDo/issues/47) (эпик
[#57](https://github.com/toHellForThem/ToDoSoDo/issues/57)). CI-сборка и
публикация артефактов — задача [#48](https://github.com/toHellForThem/ToDoSoDo/issues/48).

## Версии и identifier

Источник истины для версии приложения — `expo.version` в
[`frontend/app.json`](../../frontend/app.json). Версия обязана совпадать во
всех манифестах, из которых собираются установщики:

| Файл | Поле |
| --- | --- |
| [`frontend/app.json`](../../frontend/app.json) | `expo.version` |
| [`frontend/package.json`](../../frontend/package.json) | `version` |
| [`desktop-tauri/package.json`](../package.json) | `version` |
| [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) | `[package].version` |
| [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) | `version` |

Проверка:

```sh
cd desktop-tauri
npm run version:check
```

Скрипт [`check-versions.mjs`](../scripts/check-versions.mjs) падает, если
версии разошлись или если `identifier`/`productName` Tauri пустые. От
`productName` зависят релизные имена артефактов; у Tauri —
`com.todosodo.desktop.tauri`.

Платформенные `tauri.windows.conf.json` и `tauri.linux.conf.json` не должны
переопределять `version`, `productName` или `identifier`: они сливаются поверх
базового конфига и незаметно ломают проверки выше.

## Артефакты

| Платформа | Цель | Итоговое имя | Особенности |
| --- | --- | --- | --- |
| Windows | NSIS | `ToDoSoDo-<version>-x64-setup.exe` | `installMode: currentUser` — установка без прав администратора |
| Linux | AppImage | `ToDoSoDo-<version>-amd64.AppImage` | `bundleMediaFramework: false` — медиа в приложении нет |
| Linux | deb | `ToDoSoDo-<version>-amd64.deb` | `depends: libwebkit2gtk-4.1-0` |

В базовом конфиге `bundle.targets: "all"`, но платформенные файлы оставляют
только нужные цели: [`tauri.windows.conf.json`](../src-tauri/tauri.windows.conf.json)
(только NSIS, MSI/WiX не собираем) и
[`tauri.linux.conf.json`](../src-tauri/tauri.linux.conf.json) (только AppImage
и deb, RPM не собираем).

### Имена файлов

Tauri v2 не предоставляет настройку `artifactName`: бандлер всегда собирает
`<productName>_<version>_<arch>...`. Чтобы имя Windows-установщика было
`${productName}-${version}-${arch}-setup.${ext}`, после сборки запускается
[`rename-artifacts.mjs`](../scripts/rename-artifacts.mjs):

```sh
cd desktop-tauri
npm run release            # tauri build + переименование
npm run artifacts:rename   # только переименование уже собранных бандлов
```

`npm run build` оставляет штатные имена Tauri и нужен для отладки. Для релиза
используется только `npm run release`. Скрипт идемпотентен: повторный запуск
пропускает уже переименованные файлы.

## Windows

- **WebView2**: `bundle.windows.webviewInstallMode` явно задан как
  `embedBootstrapper`. Загрузчик WebView2 зашит в установщик (+~1.8 МБ), но
  **сам рантайм скачивается из интернета**. Для машин без сети нужен
  `offlineInstaller` (+~127 МБ) — отдельное решение, если появится запрос.
- **Подпись кода**: сертификата нет, установщик не подписан. SmartScreen
  покажет предупреждение «Unknown publisher» — это принятое ограничение
  первого релиза. Настройка сертификата в CI — отдельная задача; место под
  секреты в конфиге не занимаем.
- **Автообновление**: в первом релизе отсутствует. В
  [`tauri.conf.json`](../src-tauri/tauri.conf.json) стоит
  `createUpdaterArtifacts: false`; Tauri updater (ключи подписи, хостинг
  манифеста) — отдельная задача.

Сборка на Windows:

```powershell
cd desktop-tauri
npm ci
npm run version:check
npm run release
```

## Linux

Минимальные версии дистрибутивов — **Ubuntu 22.04+** и **Debian 12+**: в них
есть `libwebkit2gtk-4.1-0`, от которого зависит deb-пакет. В Debian 11
доступен только WebKitGTK 4.0.

Зависимости сборки — как в
[`docker/linux-verify.Dockerfile`](../docker/linux-verify.Dockerfile):
`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev`,
`libayatana-appindicator3-dev`, `patchelf`, `pkg-config`, `libssl-dev`.

```sh
cd desktop-tauri
npm ci
npm run version:check
npm run release
```

Проверочный запуск без установки webkit-пакетов в систему — через контейнер:

```sh
docker build -f desktop-tauri/docker/linux-verify.Dockerfile -t todosodo-tauri-linux .
docker run --rm --privileged --network host \
  -v "$PWD/desktop-tauri/docker/verify-run.sh:/verify-run.sh:ro" \
  -v "$PWD/desktop-tauri/docs/spike:/out" \
  todosodo-tauri-linux bash /verify-run.sh
```

## Процесс релиза

1. Поднять версию в `frontend/app.json` и синхронно — в остальных манифестах
   из таблицы выше.
2. `npm run version:check` — версии и identifier согласованы.
3. Смерджить в `main` и поставить тег `vX.Y.Z` (ровно как в `app.json`):
   ```sh
   git tag v1.0.3
   git push origin v1.0.3
   ```
4. CI `Tauri` соберёт Windows/Linux и создаст **draft**-релиз с
   `*-setup.exe`, `.AppImage` и `.deb`. Тег, не совпадающий с версией
   приложения, падает на шаге `Validate tag matches app version`.
5. Прогнать smoke:
   - Linux: `verify-run.sh` в контейнере (скриншот, ввод задачи, сокеты);
   - Windows: чек-лист на чистой VM ниже.
6. Опубликовать draft-релиз после проверки.

## Чек-лист на чистой Windows VM

Локальной Windows нет; проверка выполняется на VM (задача
[#49](https://github.com/toHellForThem/ToDoSoDo/issues/49)) со снапшотом
чистой системы. Отметить при релизе:

- [ ] `tauri dev` и `tauri build` проходят на Windows.
- [ ] NSIS ставится в профиль текущего пользователя без запроса UAC.
- [ ] На системе без WebView2 установщик скачивает рантайм (нужен интернет).
- [ ] Приложение запускается, окно `ToDoSoDo` открывается, UI с CSS и
      шрифтами иконок.
- [ ] Login, sync, offline/outbox, reconnect, смена `server_url` в настройках.
- [ ] Календарь, шорткаты `Ctrl+1/2/3`, свайпы мышью и тач-драг.
- [ ] Donate-ссылка открывается в системном браузере (opener).
- [ ] `localStorage` переживает перезапуск и установку поверх старой версии.
- [ ] Удаление приложения: проверить, вычищается ли профиль WebView2 из
      `%LOCALAPPDATA%`. В `installMode: currentUser` данные могут остаться —
      тогда зафиксировать как известное поведение инсталлятора Tauri.
## Откат

Откат — установка предыдущего релиза Tauri поверх текущего. Профиль WebView2
(`%LOCALAPPDATA%/com.todosodo.desktop.tauri`) при этом сохраняется. Для
пользователей, перешедших с Electron, данные переносятся экспортом/импортом,
см. [`migration.md`](migration.md).

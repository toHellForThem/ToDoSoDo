# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).

Источник истины для версии — `frontend/app.json`. Синхронность манифестов проверяет
`npm run version:check` в `desktop-tauri`.

## [Unreleased]

## [1.1.0] - 2026-11-19

- Удалён Electron-клиент `desktop/`; desktop-сборка — только Tauri.
- Релиз по тегу `vX.Y.Z`: CI собирает Windows/Linux и создаёт draft-релиз.
- Версия в «О программе» читается из `frontend/app.json`.
- `check-versions.mjs` сверяет версии frontend, Tauri и backend.

## [1.0.2] - 2026-11-13

Подробности: https://github.com/toHellForThem/ToDoSoDo/releases/tag/1.0.2

## [1.0.1] - 2026-06-16

Подробности: https://github.com/toHellForThem/ToDoSoDo/releases/tag/1.0.1

## [1.0.0] - 2026-06-04

Подробности: https://github.com/toHellForThem/ToDoSoDo/releases/tag/1.0.0

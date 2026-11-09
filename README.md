<div align="center">
  <h1>🚀 ToDoSoDo</h1>
  <p><i>Кроссплатформенное приложение для управления задачами с упором на удобство, универсальность и offline-first архитектуру.</i></p>

  <!-- Бэйджи CI -->
  <a href="https://github.com/toHellForThem/ToDoSoDo/actions/workflows/python-app.yml"><img src="https://github.com/toHellForThem/ToDoSoDo/actions/workflows/python-app.yml/badge.svg" alt="CI" /></a>

  <!-- Бэйджи с технологиями -->
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
</div>

---

![Demo](https://github.com/user-attachments/assets/2319141e-f3eb-42cb-a02c-cf3d39ba2eda)

## 📱 О проекте

**ToDoSoDo** - это универсальный инструмент для организации вашей жизни. Приложение создано для максимального удобства и позволяет не только вести обычные списки дел, но и отслеживать привычки, контролировать накопления на цели и сохранять прогресс в хобби.

### 🌟 Ключевые фичи
- 🎯 **Triple-Mode Logic:** Бесшовное переключение между Классическим to-do листом, Ежедневными задачами (с трекером привычек) и RPG-режимом, который нужен для глубокого отслеживания жизни (серии сериалов, фильмы, контроль накоплений на цели).
- 🔌 **Offline-First:** Полноценная работа без подключения к интернету. Данные надежно лежат в быстром локальном хранилище на устройстве (через `react-native-mmkv`) и синхронизируются в фоне при появлении сети.
- ⚡ **Real-Time Синхронизация:** Мгновенное обновление задач на всех устройствах (телефон, ПК) через WebSockets с встроенным алгоритмом разрешения конфликтов версий.

---
## Hard Problems & Инженерные решения

Идея - проверить свои навыки, создав проект, который закрывает реальную проблему, а не учебную.

Мне нужно было приложение, которое я бы использовал и на телефоне, и на компьютере. Чтобы оно покрывало мою потребность разложить жизнь по логичным блокам, местами даже геймифицированно: вот календарь с привычками и прогрессом за каждый день, вот ежедневные задачи, которые сбрасываются каждый день, вот фильмы и сериалы - что смотрел и на какой серии остановился, вот накопления на цели, а в конце - обычный to-do лист.

Условия, которые я себе поставил:

- решать реальную проблему;
- не терять основной функционал без интернета;
- иметь потенциал для шорткатов;
- иметь кастомизируемый интерфейс;
- работать в локальной сети, сохраняя приватность.

### Что было выбрано

- **Кроссплатформенность** - JavaScript (позже TypeScript) + React Native + Electron.
- **Self-hosting** - простой сервер на Python + FastAPI.
- **Хранилище на сервере** - SQLite в режиме WAL: простая база, но с упором на отказоустойчивость при множестве конкурентных запросов.
- **Локальное хранилище** - MMKV для Android, localStorage для Electron.
- **Приватность** - авторизация с JWT-токенами.
- **Связь клиентов** - WebSocket через Socket.IO.

### Проблемы и решения

- **MMKV не инициализировался через `new`.** Решение - создание через `createMMKV()`.
- **`Swipeable` из reanimated давал большие просадки по FPS.** Решение - альтернатива из старой библиотеки, `Swipeable` из `react-native-gesture-handler`.
- **Выезжающая шторка всё время ломалась.** Решение - делегировать логику: корень блокирует фон и владеет хуком, но не рендерит; рендерит хедер.
- **Начало нового дня ломалось то в активном, то в неактивном приложении.** Решение - две проверки: сразу после захода в приложение и по таймеру, пока приложение открыто.
- **Удаление задачи не доходило до офлайн-устройства.** Решение - tombstone: задача пишется в отдельную таблицу, и сервер сверяет по ней данные при синхронизации.

### Хотелки, которые тоже сделаны

- Эмодзи заменены на иконки.
- Реализованы плавающие дополнения к клавиатуре.
- Проведён рефакторинг на TypeScript.
- Код разделён: табы отдельно, тексты отдельно, хуки и компоненты, темы - всё отдельно.
- Добавлен Docker-контейнер.

---

## 📥 Установка и загрузка

Приложение готово к использованию на Android, Windows:

* 🤖 **Android:** Скачать из [RuStore](https://www.rustore.ru/catalog/app/com.anonymous.toDoSoDo) или [GitHub APK](https://github.com/toHellForThem/ToDoSoDo/releases/latest)
* 💻 **Windows:** Скачать [.exe приложение](https://github.com/toHellForThem/ToDoSoDo/releases/latest)
* 🐧 **Linux:** В разработке ⏳

---

## 🐳 Self-Hosting (Docker)

### Требования
- Docker Engine 24+ и Docker Compose v2

### Быстрый старт
```bash
git clone https://github.com/toHellForThem/ToDoSoDo.git
cd ToDoSoDo/backend
cp .env.example .env
printf 'JWT_SECRET_KEY=%s\n' "$(openssl rand -hex 32)" > .env
docker compose up -d --build
docker compose ps
docker compose logs -f backend

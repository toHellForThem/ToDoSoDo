#!/usr/bin/env bash
# Запускает собранную Tauri-оболочку в виртуальном X-сервере и делает
# скриншот. Используется спайком (и ручными проверками), запускается
# внутри linux-verify контейнера:
#
#   docker build -f desktop-tauri/docker/linux-verify.Dockerfile -t todosodo-tauri-linux .
#   mkdir -p desktop-tauri/docs/spike
#   docker run --rm --privileged --network host \
#     -e PROBE_INPUT=1 \
#     -v "$PWD/desktop-tauri/docker/verify-run.sh:/verify-run.sh:ro" \
#     -v "$PWD/desktop-tauri/docs/spike:/out" \
#     todosodo-tauri-linux bash /verify-run.sh
#
# `--network host` нужен, чтобы webview достучался до бэкенда на 127.0.0.1:8000,
# `--privileged` — чтобы стартовал sandbox WebKit (bwrap).
#
# Артефакты в /out:
#   screenshot.png      — окно приложения после загрузки
#   screenshot-typed.png— после ввода задачи (PROBE_INPUT=1)
#   sockets.txt         — установленные соединения к :8000 из webview
#   app.log             — stdout/stderr приложения

set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}

export DISPLAY=:99
export LIBGL_ALWAYS_SOFTWARE=1
export WEBKIT_DISABLE_COMPOSITING_MODE=1

Xvfb :99 -screen 0 1100x750x24 >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!
sleep 2

APP_BIN=/src/desktop-tauri/src-tauri/target/release/todosodo-desktop
"$APP_BIN" > "$OUT_DIR/app.log" 2>&1 &
APP_PID=$!
sleep 12

import -window root "$OUT_DIR/screenshot.png"
ss -tnp > "$OUT_DIR/sockets.txt" 2>&1 || true

if [ "${PROBE_INPUT:-0}" = "1" ]; then
  # Клик по полю «Add task…», ввод и Enter: проверяет ввод, клавиатуру и
  # запись задачи в локальное хранилище (пользователь не залогинен, сеть
  # не задействована).
  xdotool mousemove 520 176 click 1
  sleep 1
  xdotool type --delay 40 "spike task"
  xdotool key Return
  sleep 2
  import -window root "$OUT_DIR/screenshot-typed.png"
fi

kill "$APP_PID" 2>/dev/null || true
kill "$XVFB_PID" 2>/dev/null || true

echo "--- sockets to backend ---"
grep -E ':8000' "$OUT_DIR/sockets.txt" || echo "no :8000 connections"

# Проверочная сборка Tauri-оболочки под Linux (Debian/Ubuntu-совместимая
# система). Используется спайком и в будущем пригодится для CI (задача 3.7):
# на Gentoo/Arch набор пакетов называется иначе, а в CI и в Docker проще
# фиксировать один и тот же список зависимостей.
#
# Сборка (контекст — корень репозитория):
#   docker build -f desktop-tauri/docker/linux-verify.Dockerfile -t todosodo-tauri-linux .
#
# Только проверка компиляции без bundling:
#   cargo build --release --manifest-path desktop-tauri/src-tauri/Cargo.toml

FROM rust:1.98-bookworm AS build

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev \
      libgtk-3-dev \
      librsvg2-dev \
      libayatana-appindicator3-dev \
      patchelf \
      pkg-config \
      libssl-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Контекст — корень репозитория: нужны и Rust-исходники, и готовый
# `frontend/dist` (tauri-build проверяет, что frontendDist существует).
COPY desktop-tauri/src-tauri ./desktop-tauri/src-tauri
COPY frontend/dist ./frontend/dist

# `custom-protocol` обязателен: без него `frontendDist` не встраивается в
# бинарник и webview показывает страницу ошибки WebKit. tauri-cli включает
# фичу сам, но здесь мы вызываем cargo напрямую.
RUN cargo build --release \
      --features custom-protocol \
      --manifest-path desktop-tauri/src-tauri/Cargo.toml

CMD ["bash"]

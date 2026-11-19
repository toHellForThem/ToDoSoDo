/**
 * Собирает web-бандл фронтенда в `frontend/dist` для Tauri.
 *
 * Адрес API вшивается в бандл при сборке, как и в Electron/e2e:
 * `TAURI_SOCKET_URL` (по умолчанию — `http://127.0.0.1:8000`, чтобы
 * сборка не тянула пользователя в чужую локальную сеть). В рантайме
 * адрес всё равно переопределяется настройкой `server_url`.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(here, '..', '..', 'frontend');
const socketUrl = process.env.TAURI_SOCKET_URL || 'http://127.0.0.1:8000';

const result = spawnSync('npm', ['run', 'export:web', '--', '--clear'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_SOCKET_URL: socketUrl },
});

process.exit(result.status ?? 1);

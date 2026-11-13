/**
 * Собирает web-бандл с адресом API, который будет использован E2E.
 *
 * По умолчанию — локальный сервер из playwright.config.ts (порт 8001).
 * Для существующего бэкенда: E2E_BACKEND_URL=http://127.0.0.1:8000 npm run e2e:build
 */

import { spawnSync } from 'node:child_process';

const socketUrl = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:8001';

const result = spawnSync(
  'npx',
  ['expo', 'export', '--platform', 'web', '--clear'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, EXPO_PUBLIC_SOCKET_URL: socketUrl },
  },
);

process.exit(result.status ?? 1);

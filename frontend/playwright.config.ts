import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke на web-сборке.
 *
 * Бэкенд поднимается отдельным процессом на 127.0.0.1:8001 с временной
 * SQLite; статика — из `dist` на 8081. CORS бэкенда разрешает origin 8081.
 */
const E2E_PORT = 8081;
const API_PORT = 8001;
// Локально можно переиспользовать уже запущенный бэкенд:
// E2E_BACKEND_URL=http://127.0.0.1:8000 npm run e2e
const EXTERNAL_BACKEND = process.env.E2E_BACKEND_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    // Узкий viewport включает мобильную раскладку с табами.
    viewport: { width: 800, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    ...(EXTERNAL_BACKEND
      ? []
      : [
          {
            command: 'python -m uvicorn main:app --host 127.0.0.1 --port 8001',
            cwd: '../backend',
            url: `http://127.0.0.1:${API_PORT}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
            env: {
              JWT_SECRET_KEY: 'e2e-secret-key-' + 'x'.repeat(64),
              // Уникальная БД на прогон: без неё пользователи прошлых
              // запусков копятся и мешают повторяемости.
              DATABASE_PATH: join(
                tmpdir(),
                `todosodo-e2e-${process.pid}-${Date.now()}.db`,
              ),
              LOG_LEVEL: 'WARNING',
              SIO_CORS_ORIGINS: `http://127.0.0.1:${E2E_PORT},http://localhost:${E2E_PORT}`,
            },
          },
        ]),
    {
      command: `node e2e/static-server.mjs dist ${E2E_PORT}`,
      url: `http://127.0.0.1:${E2E_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});

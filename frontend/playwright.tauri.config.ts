import { defineConfig } from '@playwright/test';

/**
 * Конфиг-тесты паритета Tauri: читают файлы `desktop-tauri` напрямую.
 * Браузер и webServer не нужны — тест не зависит от CSP-сервера.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'tauri-parity.spec.ts',
  timeout: 30_000,
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report/tauri' }],
      ]
    : 'list',
});

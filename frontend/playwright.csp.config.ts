import { defineConfig, devices } from '@playwright/test';

/**
 * Регресс-тест CSP Tauri: web-сборка отдаётся с CSP из `tauri.conf.json`,
 * а Chromium резолвит `tauri.localhost` в 127.0.0.1 — как WebView2 на Windows.
 */
const CSP_PORT = 8082;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'csp.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  outputDir: 'test-results/csp',
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report/csp' }],
      ]
    : 'list',
  use: {
    baseURL: `http://tauri.localhost:${CSP_PORT}`,
    // Окно Tauri — 1100×750; широкий layout рендерит `header-settings-wide`.
    viewport: { width: 1100, height: 750 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--host-resolver-rules=MAP tauri.localhost 127.0.0.1'],
    },
  },
  projects: [
    {
      name: 'chromium-csp',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `node e2e/csp-server.mjs dist ${CSP_PORT}`,
    url: `http://127.0.0.1:${CSP_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

/**
 * Статический сервер с CSP из `tauri.conf.json` — для регресс-теста Tauri.
 *
 * CSP берётся из конфига оболочки, чтобы тест падал при расхождении с
 * реальной сборкой. Chromium в тесте резолвит `tauri.localhost` в 127.0.0.1
 * (`--host-resolver-rules`), поэтому origin совпадает с WebView2 на Windows.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './static-server-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(
  here,
  '..',
  '..',
  'desktop-tauri',
  'src-tauri',
  'tauri.conf.json',
);
const tauriConfig = JSON.parse(readFileSync(configPath, 'utf8'));
const csp = tauriConfig?.app?.security?.csp;

if (!csp) {
  throw new Error(`CSP не найдена в ${configPath}`);
}

const root = process.argv[2] || 'dist';
const port = Number(process.argv[3] || 8082);

createStaticServer({
  root,
  port,
  headers: { 'Content-Security-Policy': csp },
});

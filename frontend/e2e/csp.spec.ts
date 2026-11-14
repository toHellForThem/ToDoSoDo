/**
 * Регресс-тест CSP Tauri: статика отдаётся с CSP из `tauri.conf.json`,
 * Chromium резолвит `tauri.localhost` в 127.0.0.1 — origin как у WebView2.
 *
 * Тест падает, если CSP блокирует инлайновые стили `react-native-web`,
 * шрифты иконок или скрипты приложения.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const configPath = join(
  __dirname,
  '..',
  '..',
  'desktop-tauri',
  'src-tauri',
  'tauri.conf.json',
);
const tauriConfig = JSON.parse(readFileSync(configPath, 'utf8'));
const csp: string = tauriConfig.app.security.csp;

interface CspProbe {
  sheets: number;
  globalStyle: boolean;
  bodyUserSelect: string;
  inputUserSelect: string;
  fonts: number;
  iconFont: boolean;
  violations: string[];
}

test.describe('Tauri CSP', () => {
  // TODO: перейти на строгий CSP с хешами вместо 'unsafe-inline' —
  // см. desktop-tauri/docs/csp.md и завести отдельный issue.
  test('конфиг сохраняет компромисс: unsafe-inline для rn-web', () => {
    expect(tauriConfig.app.security.dangerousDisableAssetCspModification).toBe(
      true,
    );
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("img-src 'self' data: blob:");
  });

  test('сборка не содержит meta CSP, сужающий заголовок', () => {
    const html = readFileSync(
      join(__dirname, '..', 'dist', 'index.html'),
      'utf8',
    );
    expect(html.toLowerCase()).not.toContain('content-security-policy');
  });

  test('приложение стартует на tauri.localhost без нарушений CSP', async ({
    page,
  }) => {
    const consoleViolations: string[] = [];
    page.on('console', message => {
      if (
        message.type() === 'error' &&
        /content security policy/i.test(message.text())
      ) {
        consoleViolations.push(message.text());
      }
    });

    await page.addInitScript(() => {
      const target = window as unknown as { __cspViolations?: string[] };
      target.__cspViolations = [];
      window.addEventListener('securitypolicyviolation', event => {
        target.__cspViolations?.push(
          `${event.violatedDirective} ${event.blockedURI}`,
        );
      });
    });

    const response = await page.goto('/');
    expect(response).not.toBeNull();
    expect(response!.headers()['content-security-policy']).toBe(csp);

    // `todo-input` есть в обоих layout'ах — ждём, что приложение отрисовалось.
    await expect(page.getByTestId('todo-input')).toBeVisible();

    const probe = await page.evaluate(async (): Promise<CspProbe> => {
      await document.fonts.ready;
      const target = window as unknown as { __cspViolations?: string[] };
      const input = document.querySelector('[data-testid="todo-input"]');
      let fonts = 0;
      document.fonts.forEach(() => {
        fonts += 1;
      });
      return {
        sheets: document.styleSheets.length,
        globalStyle: Boolean(
          document.getElementById('todosodo-web-global-styles'),
        ),
        bodyUserSelect: getComputedStyle(document.body).userSelect,
        inputUserSelect: input ? getComputedStyle(input).userSelect : '',
        fonts,
        iconFont: document.fonts.check('16px "MaterialCommunityIcons"'),
        violations: target.__cspViolations ?? [],
      };
    });

    // Инлайновые стили rn-web и глобальный stylesheet применились.
    expect(probe.globalStyle).toBe(true);
    expect(probe.sheets).toBeGreaterThan(0);
    expect(probe.bodyUserSelect).toBe('none');
    // Инпуты — исключение из глобального `user-select: none`.
    expect(probe.inputUserSelect).toBe('text');
    // Шрифты иконок загрузились, а не отрисовались квадратами.
    expect(probe.fonts).toBeGreaterThan(0);
    expect(probe.iconFont).toBe(true);

    expect(probe.violations).toEqual([]);
    expect(consoleViolations).toEqual([]);
  });
});

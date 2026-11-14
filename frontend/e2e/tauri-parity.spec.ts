/**
 * Регресс-тест паритета Tauri с Electron: окно, меню и внешние ссылки.
 *
 * Читает конфиг, capabilities и Rust-точку входа напрямую — расхождение
 * ловится без сборки приложения.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const tauriDir = join(__dirname, '..', '..', 'desktop-tauri', 'src-tauri');
const tauriConfig = JSON.parse(
  readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8'),
);
const capabilities = JSON.parse(
  readFileSync(join(tauriDir, 'capabilities', 'default.json'), 'utf8'),
);
const cargoToml = readFileSync(join(tauriDir, 'Cargo.toml'), 'utf8');
const libRs = readFileSync(join(tauriDir, 'src', 'lib.rs'), 'utf8');

test.describe('Tauri parity с Electron', () => {
  test('окно 1100×750, заголовок ToDoSoDo, по центру', () => {
    const [mainWindow] = tauriConfig.app.windows;
    expect(mainWindow.label).toBe('main');
    expect(mainWindow.title).toBe('ToDoSoDo');
    expect(mainWindow.width).toBe(1100);
    expect(mainWindow.height).toBe(750);
    expect(mainWindow.center).toBe(true);
  });

  test('нативного меню нет', () => {
    expect(tauriConfig.app.menu).toBeUndefined();
  });

  test('opener подключён и разрешён главному окну', () => {
    expect(cargoToml).toContain('tauri-plugin-opener');
    expect(libRs).toContain('tauri_plugin_opener::init()');
    expect(capabilities.windows).toContain('main');
    expect(capabilities.permissions).toContain('opener:default');
  });
});

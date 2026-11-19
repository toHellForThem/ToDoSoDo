#!/usr/bin/env node
/**
 * Проверяет релизный контракт версий и идентификаторов.
 *
 * Источник истины для версии приложения — `frontend/app.json` (Expo). Все
 * манифесты, из которых собираются артефакты (web, Tauri, backend), должны
 * нести ту же версию, иначе установщик Tauri окажется «старее» или «новее»
 * бандла, а NSIS обновит приложение поверх другой версии.
 *
 * `identifier` и `productName` Tauri не должны быть пустыми: от них зависят
 * установка и релизные имена артефактов.
 *
 * Запуск: `npm run version:check` из `desktop-tauri` (или `node scripts/...`).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const readJson = path => JSON.parse(readFileSync(join(repoRoot, path), 'utf8'));

const readCargoVersion = path => {
  const toml = readFileSync(join(repoRoot, path), 'utf8');
  const match = toml.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error(`Не найден version в [package]: ${path}`);
  }
  return match[1];
};

const readEnvVersion = path => {
  const text = readFileSync(join(repoRoot, path), 'utf8');
  const match = text.match(/^APP_VERSION=(.+)$/m);
  if (!match) {
    throw new Error(`Не найден APP_VERSION: ${path}`);
  }
  return match[1].trim();
};

const readPythonDefaultVersion = path => {
  const text = readFileSync(join(repoRoot, path), 'utf8');
  const match = text.match(/app_version:\s*str\s*=\s*"([^"]+)"/);
  if (!match) {
    throw new Error(`Не найден app_version: ${path}`);
  }
  return match[1];
};

const appVersion = readJson('frontend/app.json').expo?.version;
if (!appVersion) {
  console.error('frontend/app.json: не найден expo.version');
  process.exit(1);
}

const versionSources = [
  ['frontend/app.json', appVersion],
  ['frontend/package.json', readJson('frontend/package.json').version],
  ['desktop-tauri/package.json', readJson('desktop-tauri/package.json').version],
  ['desktop-tauri/src-tauri/Cargo.toml', readCargoVersion('desktop-tauri/src-tauri/Cargo.toml')],
  ['desktop-tauri/src-tauri/tauri.conf.json', readJson('desktop-tauri/src-tauri/tauri.conf.json').version],
  ['backend/.env.example', readEnvVersion('backend/.env.example')],
  ['backend/app/config.py', readPythonDefaultVersion('backend/app/config.py')],
];

const tauriConfig = readJson('desktop-tauri/src-tauri/tauri.conf.json');

const errors = [];

console.log(`Версия приложения (источник: frontend/app.json): ${appVersion}`);
for (const [path, version] of versionSources) {
  if (version === appVersion) {
    console.log(`  ok   ${path}: ${version}`);
  } else {
    console.error(`  FAIL ${path}: ${version} (ожидалось ${appVersion})`);
    errors.push(path);
  }
}

const tauriIdentifier = tauriConfig.identifier;
if (!tauriIdentifier) {
  console.error('  FAIL desktop-tauri/src-tauri/tauri.conf.json: пустой identifier');
  errors.push('identifier');
} else {
  console.log(`  ok   identifier: ${tauriIdentifier}`);
}

// productName попадает в имена артефактов (`rename-artifacts.mjs`).
const tauriProductName = tauriConfig.productName;
if (!tauriProductName) {
  console.error('  FAIL desktop-tauri/src-tauri/tauri.conf.json: пустой productName');
  errors.push('productName');
} else {
  console.log(`  ok   productName: ${tauriProductName}`);
}

// Платформенные конфиги сливаются поверх базового. Version, productName и
// identifier в них переопределять нельзя: релизные имена и установку они
// меняют незаметно для таблицы версий выше.
const platformConfigs = [
  'desktop-tauri/src-tauri/tauri.windows.conf.json',
  'desktop-tauri/src-tauri/tauri.linux.conf.json',
];
const reservedKeys = ['version', 'productName', 'identifier'];
for (const path of platformConfigs) {
  const platformConfig = readJson(path);
  for (const key of reservedKeys) {
    if (key in platformConfig) {
      console.error(`  FAIL ${path}: платформенный конфиг не должен переопределять ${key}`);
      errors.push(`${path}:${key}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`\nРасхождения: ${errors.join(', ')}`);
  process.exit(1);
}

console.log('\nВерсии, identifier и productName согласованы.');

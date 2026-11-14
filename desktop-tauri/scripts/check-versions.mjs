#!/usr/bin/env node
/**
 * Проверяет релизный контракт версий и идентификаторов.
 *
 * Источник истины для версии приложения — `frontend/app.json` (Expo). Все
 * манифесты, из которых собираются артефакты (web, Electron, Tauri), должны
 * нести ту же версию, иначе установщик Tauri окажется «старее» или «новее»
 * бандла, а NSIS обновит приложение поверх другой версии.
 *
 * Идентификатор Tauri обязан отличаться от Electron: установщики с одинаковым
 * identifier ставятся в одну папку и перезаписывают друг друга, а Electron
 * остаётся для отката (#46).
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

const appVersion = readJson('frontend/app.json').expo?.version;
if (!appVersion) {
  console.error('frontend/app.json: не найден expo.version');
  process.exit(1);
}

const versionSources = [
  ['frontend/app.json', appVersion],
  ['frontend/package.json', readJson('frontend/package.json').version],
  ['desktop/package.json', readJson('desktop/package.json').version],
  ['desktop-tauri/package.json', readJson('desktop-tauri/package.json').version],
  ['desktop-tauri/src-tauri/Cargo.toml', readCargoVersion('desktop-tauri/src-tauri/Cargo.toml')],
  ['desktop-tauri/src-tauri/tauri.conf.json', readJson('desktop-tauri/src-tauri/tauri.conf.json').version],
];

const tauriConfig = readJson('desktop-tauri/src-tauri/tauri.conf.json');
const electronConfig = readJson('desktop/package.json');
const electronAppId = electronConfig.build?.appId;

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
} else if (electronAppId && tauriIdentifier === electronAppId) {
  console.error(
    `  FAIL identifier Tauri совпадает с Electron (${electronAppId}): ` +
      'установщики перезапишут друг друга, откат на Electron невозможен',
  );
  errors.push('identifier');
} else {
  console.log(
    `  ok   identifier: ${tauriIdentifier} (Electron: ${electronAppId ?? 'не задан'})`,
  );
}

if (errors.length > 0) {
  console.error(`\nРасхождения: ${errors.join(', ')}`);
  process.exit(1);
}

console.log('\nВерсии и identifier согласованы.');

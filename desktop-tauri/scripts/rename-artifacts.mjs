#!/usr/bin/env node
/**
 * Переименовывает артефакты `tauri build` в релизные имена.
 *
 * Tauri v2 не предоставляет настройку `artifactName`: бандлер всегда собирает
 * файлы как `<productName>_<version>_<arch>...`. Чтобы имя установщика было
 * `${productName}-${version}-${arch}-setup.${ext}`, скрипт заменяет
 * разделители в префиксе после сборки:
 *
 *   ToDoSoDo_1.1.0_x64-setup.exe  -> ToDoSoDo-1.1.0-x64-setup.exe
 *   ToDoSoDo_1.1.0_amd64.deb      -> ToDoSoDo-1.1.0-amd64.deb
 *   ToDoSoDo_1.1.0_amd64.AppImage -> ToDoSoDo-1.1.0-amd64.AppImage
 *
 * Запускается из `npm run release` после `tauri build`; повторный запуск
 * безопасен (уже переименованные файлы пропускаются). Корень бандлов можно
 * переопределить переменной `TAURI_BUNDLE_ROOT` (используется в проверках).
 */

import { existsSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tauriDir = join(here, '..', 'src-tauri');
const config = JSON.parse(readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8'));

const productName = config.productName;
const version = config.version;
if (!productName || !version) {
  console.error('tauri.conf.json: не найдены productName/version');
  process.exit(1);
}

const bundleRoot = resolve(
  process.env.TAURI_BUNDLE_ROOT || join(tauriDir, 'target', 'release', 'bundle'),
);
const bundleDirs = ['nsis', 'deb', 'appimage'];

const tauriPrefix = `${productName}_${version}_`;
const releasePrefix = `${productName}-${version}-`;

let found = 0;
let renamed = 0;

for (const dirName of bundleDirs) {
  const dir = join(bundleRoot, dirName);
  if (!existsSync(dir)) {
    continue;
  }

  for (const entry of readdirSync(dir)) {
    if (!entry.startsWith(tauriPrefix) && !entry.startsWith(releasePrefix)) {
      continue;
    }
    found += 1;

    if (entry.startsWith(releasePrefix)) {
      console.log(`${dirName}: ${entry} уже переименован`);
      continue;
    }

    const source = join(dir, entry);
    if (!statSync(source).isFile()) {
      continue;
    }

    const targetName = `${releasePrefix}${entry.slice(tauriPrefix.length)}`;
    const target = join(dir, targetName);
    if (existsSync(target)) {
      console.error(`${dirName}: ${targetName} уже существует, переименование отменено`);
      process.exit(1);
    }

    renameSync(source, target);
    console.log(`${dirName}: ${entry} -> ${targetName}`);
    renamed += 1;
  }
}

if (found === 0) {
  console.error(`Не найдено артефактов в ${bundleRoot} (ожидались ${tauriPrefix}*)`);
  process.exit(1);
}

console.log(`Переименовано артефактов: ${renamed}`);

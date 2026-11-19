#!/usr/bin/env node
/**
 * Добавляет release-подпись в сгенерированный `android/app/build.gradle`.
 *
 * `expo prebuild` создаёт release-сборку с debug-подписью. Скрипт заменяет
 * её на конфиг из env-переменных, чтобы keystore не попадал в репозиторий.
 *
 * Запуск: `node scripts/patch-android-signing.mjs android/app/build.gradle`.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/patch-android-signing.mjs <app/build.gradle>');
  process.exit(1);
}

let text = readFileSync(path, 'utf8');

const oldSigning = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const newSigning = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file(System.getenv("TODO_RELEASE_STORE_FILE") ?: "release.keystore")
            storePassword System.getenv("TODO_RELEASE_STORE_PASSWORD")
            keyAlias System.getenv("TODO_RELEASE_KEY_ALIAS")
            keyPassword System.getenv("TODO_RELEASE_KEY_PASSWORD")
        }
    }`;

const oldRelease = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const newRelease = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.release`;

if (!text.includes(oldSigning)) {
  console.error('signingConfigs block not found');
  process.exit(1);
}
if (!text.includes(oldRelease)) {
  console.error('release buildType block not found');
  process.exit(1);
}

text = text.replace(oldSigning, newSigning);
text = text.replace(oldRelease, newRelease);
writeFileSync(path, text);
console.log('patched:', path);

/**
 * Экспорт и импорт локальных данных через JSON-файл.
 *
 * Работает в web-сборке (Electron и Tauri): пользователь выгружает файл в
 * старой версии и загружает его в новой. На native-платформах не используется.
 */
import { getIsTauri, platformStorage } from '../platform';
import {
  applyLocalData,
  buildLocalDataFile,
  LOCAL_DATA_KEYS,
  parseLocalData,
  serializeLocalData,
  type ApplyLocalDataResult,
  type LocalDataFile,
  type LocalDataKey,
} from './localData';

const detectSource = (): string => {
  if (getIsTauri()) return 'tauri';
  if (
    typeof navigator !== 'undefined' &&
    /electron/i.test(navigator.userAgent)
  ) {
    return 'electron';
  }
  return 'web';
};

/** Читает все известные ключи из текущего хранилища. */
export const collectLocalData = (): Partial<Record<LocalDataKey, string>> => {
  const data: Partial<Record<LocalDataKey, string>> = {};
  for (const key of LOCAL_DATA_KEYS) {
    const value = platformStorage.get(key);
    if (value !== null) {
      data[key] = value;
    }
  }
  return data;
};

export const exportLocalData = (): LocalDataFile =>
  buildLocalDataFile(collectLocalData(), { source: detectSource() });

const buildFileName = (exportedAt: string): string => {
  const date = /^\d{4}-\d{2}-\d{2}/.test(exportedAt)
    ? exportedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return `todosodo-backup-${date}.json`;
};

/** Скачивает JSON-файл средствами браузера/webview. */
export const downloadLocalData = (): LocalDataFile => {
  const file = exportLocalData();
  const blob = new Blob([serializeLocalData(file)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildFileName(file.exportedAt);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return file;
};

/** Открывает системный диалог выбора файла и возвращает его содержимое. */
export const pickLocalDataFile = (): Promise<string | null> =>
  new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';

    const cleanup = () => input.remove();

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        cleanup();
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => {
        cleanup();
        resolve(null);
      };
      reader.readAsText(file);
    };

    document.body.appendChild(input);
    input.click();
  });

/** Применяет содержимое файла к текущему хранилищу. */
export const importLocalData = (raw: string): ApplyLocalDataResult => {
  const file = parseLocalData(raw);
  return applyLocalData(file, {
    set: (key, value) => platformStorage.set(key, value),
  });
};

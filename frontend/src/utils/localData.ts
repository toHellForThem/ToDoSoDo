/**
 * Формат переноса локальных данных между Electron- и Tauri-сборками.
 *
 * Чистые функции без DOM и react-native: их можно тестировать в Node и
 * переиспользовать в любом окружении. Работа с `localStorage`/файлами
 * живёт в `dataTransfer.ts`.
 */

export const LOCAL_DATA_FORMAT = 'todosodo-local-data';
export const LOCAL_DATA_VERSION = 1;

/** Ключи, которые приложение хранит в `localStorage` (см. `storage.ts`). */
export const LOCAL_DATA_KEYS = [
  'username',
  'user_token',
  'user_settings',
  'server_url',
  'todo_list',
  'rpg_history',
  'sync_outbox',
  'todo_tombstones',
] as const;

export type LocalDataKey = (typeof LOCAL_DATA_KEYS)[number];

/**
 * `user_token` — JWT с ограниченным сроком жизни. Переносить его между
 * установками бессмысленно: после импорта пользователь всё равно входит
 * заново, поэтому токен не экспортируем и не применяем.
 */
export const TRANSFERABLE_KEYS: readonly LocalDataKey[] =
  LOCAL_DATA_KEYS.filter(key => key !== 'user_token');

/** Значения этих ключей — JSON; проверяем, что файл не повреждён. */
const JSON_VALUE_KEYS: readonly LocalDataKey[] = [
  'user_settings',
  'todo_list',
  'rpg_history',
  'sync_outbox',
  'todo_tombstones',
];

export interface LocalDataFile {
  format: typeof LOCAL_DATA_FORMAT;
  version: number;
  exportedAt: string;
  source: string;
  data: Partial<Record<LocalDataKey, string>>;
}

export type LocalDataParseErrorCode =
  | 'invalid-json'
  | 'invalid-format'
  | 'unsupported-version'
  | 'invalid-data'
  | 'invalid-value';

export class LocalDataParseError extends Error {
  readonly code: LocalDataParseErrorCode;
  readonly key?: LocalDataKey;

  constructor(code: LocalDataParseErrorCode, key?: LocalDataKey) {
    super(key ? `${code}:${key}` : code);
    this.name = 'LocalDataParseError';
    this.code = code;
    this.key = key;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pickTransferable = (
  data: Partial<Record<LocalDataKey, string>>,
): Partial<Record<LocalDataKey, string>> => {
  const result: Partial<Record<LocalDataKey, string>> = {};
  for (const key of TRANSFERABLE_KEYS) {
    const value = data[key];
    if (typeof value === 'string' && value.length > 0) {
      result[key] = value;
    }
  }
  return result;
};

/** Собирает файл переноса из «сырых» значений хранилища. */
export const buildLocalDataFile = (
  data: Partial<Record<LocalDataKey, string>>,
  options: { source?: string; exportedAt?: string } = {},
): LocalDataFile => ({
  format: LOCAL_DATA_FORMAT,
  version: LOCAL_DATA_VERSION,
  exportedAt: options.exportedAt ?? new Date().toISOString(),
  source: options.source ?? 'unknown',
  data: pickTransferable(data),
});

export const serializeLocalData = (file: LocalDataFile): string =>
  JSON.stringify(file, null, 2);

/**
 * Разбирает и валидирует файл переноса. Неизвестные ключи игнорируются,
 * `user_token` отбрасывается, битые JSON-значения считаются ошибкой.
 */
export const parseLocalData = (raw: string): LocalDataFile => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LocalDataParseError('invalid-json');
  }

  if (!isRecord(parsed) || parsed.format !== LOCAL_DATA_FORMAT) {
    throw new LocalDataParseError('invalid-format');
  }

  const version = parsed.version;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > LOCAL_DATA_VERSION
  ) {
    throw new LocalDataParseError('unsupported-version');
  }

  if (!isRecord(parsed.data)) {
    throw new LocalDataParseError('invalid-data');
  }

  const data: Partial<Record<LocalDataKey, string>> = {};
  for (const key of TRANSFERABLE_KEYS) {
    const value = parsed.data[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') {
      throw new LocalDataParseError('invalid-value', key);
    }
    if (JSON_VALUE_KEYS.includes(key)) {
      try {
        JSON.parse(value);
      } catch {
        throw new LocalDataParseError('invalid-value', key);
      }
    }
    data[key] = value;
  }

  return {
    format: LOCAL_DATA_FORMAT,
    version,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
    source: typeof parsed.source === 'string' ? parsed.source : 'unknown',
    data,
  };
};

export interface LocalDataWriter {
  set: (key: string, value: string) => void;
}

export interface ApplyLocalDataResult {
  imported: LocalDataKey[];
  skipped: LocalDataKey[];
}

/** Записывает данные файла в хранилище, не трогая отсутствующие ключи. */
export const applyLocalData = (
  file: LocalDataFile,
  writer: LocalDataWriter,
): ApplyLocalDataResult => {
  const imported: LocalDataKey[] = [];
  const skipped: LocalDataKey[] = [];

  for (const key of LOCAL_DATA_KEYS) {
    const value = file.data[key];
    if (value === undefined) continue;
    if (!TRANSFERABLE_KEYS.includes(key)) {
      skipped.push(key);
      continue;
    }
    writer.set(key, value);
    imported.push(key);
  }

  return { imported, skipped };
};

import { describe, expect, it } from 'vitest';
import {
  applyLocalData,
  buildLocalDataFile,
  LOCAL_DATA_FORMAT,
  LOCAL_DATA_VERSION,
  LocalDataParseError,
  parseLocalData,
  serializeLocalData,
} from '../localData';

const validData = {
  username: 'alice',
  user_token: 'jwt-token',
  user_settings: JSON.stringify({ theme: 'dark' }),
  server_url: 'http://localhost:8000',
  todo_list: JSON.stringify([{ id: '1', title: 'task' }]),
  rpg_history: JSON.stringify([]),
  sync_outbox: JSON.stringify([]),
  todo_tombstones: JSON.stringify([]),
};

describe('buildLocalDataFile', () => {
  it('не экспортирует JWT и пустые значения', () => {
    const file = buildLocalDataFile(
      { ...validData, server_url: '' },
      { source: 'electron', exportedAt: '2026-11-14T00:00:00.000Z' },
    );

    expect(file.format).toBe(LOCAL_DATA_FORMAT);
    expect(file.version).toBe(LOCAL_DATA_VERSION);
    expect(file.source).toBe('electron');
    expect(file.exportedAt).toBe('2026-11-14T00:00:00.000Z');
    expect(file.data.user_token).toBeUndefined();
    expect(file.data.server_url).toBeUndefined();
    expect(file.data.username).toBe('alice');
    expect(file.data.todo_list).toBe(validData.todo_list);
  });
});

describe('parseLocalData', () => {
  it('разбирает сериализованный файл', () => {
    const file = buildLocalDataFile(validData, { source: 'electron' });
    const parsed = parseLocalData(serializeLocalData(file));

    expect(parsed).toEqual(file);
  });

  it('игнорирует user_token и неизвестные ключи', () => {
    const raw = JSON.stringify({
      format: LOCAL_DATA_FORMAT,
      version: LOCAL_DATA_VERSION,
      exportedAt: '2026-11-14T00:00:00.000Z',
      source: 'electron',
      data: { ...validData, unknown_key: 'value' },
    });

    const parsed = parseLocalData(raw);

    expect(parsed.data.user_token).toBeUndefined();
    expect(parsed.data).not.toHaveProperty('unknown_key');
    expect(parsed.data.username).toBe('alice');
  });

  it('отклоняет не-JSON', () => {
    expect(() => parseLocalData('not json')).toThrow(LocalDataParseError);
  });

  it('отклоняет чужой формат', () => {
    const raw = JSON.stringify({ format: 'other', version: 1, data: {} });
    expect(() => parseLocalData(raw)).toThrowError(
      expect.objectContaining({ code: 'invalid-format' }),
    );
  });

  it('отклоняет неподдерживаемую версию', () => {
    const raw = JSON.stringify({
      format: LOCAL_DATA_FORMAT,
      version: LOCAL_DATA_VERSION + 1,
      data: {},
    });
    expect(() => parseLocalData(raw)).toThrowError(
      expect.objectContaining({ code: 'unsupported-version' }),
    );
  });

  it('отклоняет не-объект в data', () => {
    const raw = JSON.stringify({
      format: LOCAL_DATA_FORMAT,
      version: LOCAL_DATA_VERSION,
      data: [],
    });
    expect(() => parseLocalData(raw)).toThrowError(
      expect.objectContaining({ code: 'invalid-data' }),
    );
  });

  it('отклоняет нестроковое значение', () => {
    const raw = JSON.stringify({
      format: LOCAL_DATA_FORMAT,
      version: LOCAL_DATA_VERSION,
      data: { username: 42 },
    });
    expect(() => parseLocalData(raw)).toThrowError(
      expect.objectContaining({ code: 'invalid-value', key: 'username' }),
    );
  });

  it('отклоняет битый JSON внутри значения', () => {
    const raw = JSON.stringify({
      format: LOCAL_DATA_FORMAT,
      version: LOCAL_DATA_VERSION,
      data: { todo_list: '{broken' },
    });
    expect(() => parseLocalData(raw)).toThrowError(
      expect.objectContaining({ code: 'invalid-value', key: 'todo_list' }),
    );
  });
});

describe('applyLocalData', () => {
  it('записывает переносимые ключи и пропускает токен', () => {
    const file = buildLocalDataFile(validData);
    const written: Record<string, string> = {};
    const result = applyLocalData(file, {
      set: (key, value) => {
        written[key] = value;
      },
    });

    expect(result.imported).toEqual([
      'username',
      'user_settings',
      'server_url',
      'todo_list',
      'rpg_history',
      'sync_outbox',
      'todo_tombstones',
    ]);
    expect(result.skipped).toEqual([]);
    expect(written.user_token).toBeUndefined();
    expect(written.username).toBe('alice');
  });

  it('не трогает ключи, которых нет в файле', () => {
    const file = buildLocalDataFile({ username: 'alice' });
    const written: Record<string, string> = {};
    applyLocalData(file, {
      set: (key, value) => {
        written[key] = value;
      },
    });

    expect(Object.keys(written)).toEqual(['username']);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
/**
 * Sync-reducer истории и кэша месяцев: LWW-мерж, повтор запросов,
 * статусы загрузки и поведение в офлайне.
 */

import type { DailyHistory } from '../../contract/types';

const mockEmit = vi.fn(
  (_event: string, _payload: unknown): string => 'request-1',
);
const mockGetSyncMode = vi.fn((): string => 'auth');
const mockIsOnline = vi.fn((): boolean => true);

const loadHistory = async () => {
  vi.resetModules();
  vi.doMock('../../contract/socket', () => ({ emit: mockEmit }));
  vi.doMock('../client', () => ({
    getSyncMode: mockGetSyncMode,
    isOnline: mockIsOnline,
  }));
  return (await import('../history')) as typeof import('../history');
};

const makeEntry = (
  date: string,
  overrides: Partial<DailyHistory> = {},
): DailyHistory => ({
  date,
  mood: null,
  daily_progress: 0,
  pos_points: 0,
  neg_points: 0,
  habits_detail: '',
  updatedAt: 100,
  ...overrides,
});

beforeEach(() => {
  mockEmit.mockClear();
  mockGetSyncMode.mockReturnValue('auth');
  mockIsOnline.mockReturnValue(true);
});

describe('formatMonthKey', () => {
  it('форматирует месяц как YYYY-MM', async () => {
    const { formatMonthKey } = await loadHistory();
    expect(formatMonthKey(new Date(2026, 0, 15))).toBe('2026-01');
    expect(formatMonthKey(new Date(2026, 10, 1))).toBe('2026-11');
  });
});

describe('mergeHistoryEntries', () => {
  it('добавляет отсутствующие на клиенте записи', async () => {
    const { mergeHistoryEntries } = await loadHistory();
    const result = mergeHistoryEntries([], [makeEntry('2026-11-13')]);

    expect(result.changed).toBe(true);
    expect(result.next).toHaveLength(1);
    expect(result.localNewer).toHaveLength(0);
  });

  it('заменяет локальную запись более свежей серверной', async () => {
    const { mergeHistoryEntries } = await loadHistory();
    const result = mergeHistoryEntries(
      [makeEntry('2026-11-13', { mood: 1, updatedAt: 100 })],
      [makeEntry('2026-11-13', { mood: 5, updatedAt: 200 })],
    );

    expect(result.changed).toBe(true);
    expect(result.next[0].mood).toBe(5);
  });

  it('сохраняет локальную запись новее серверной и возвращает её к отправке', async () => {
    const { mergeHistoryEntries } = await loadHistory();
    const local = makeEntry('2026-11-13', { mood: 4, updatedAt: 300 });
    const result = mergeHistoryEntries(
      [local],
      [makeEntry('2026-11-13', { mood: 2, updatedAt: 200 })],
    );

    expect(result.changed).toBe(false);
    expect(result.next[0]).toBe(local);
    expect(result.localNewer).toEqual([local]);
  });

  it('не помечает changed, если данные идентичны', async () => {
    const { mergeHistoryEntries } = await loadHistory();
    const entry = makeEntry('2026-11-13');
    const result = mergeHistoryEntries([entry], [{ ...entry }]);

    expect(result.changed).toBe(false);
  });

  it('дедуплицирует серверные записи за одну дату по updatedAt', async () => {
    const { mergeHistoryEntries } = await loadHistory();
    const result = mergeHistoryEntries(
      [],
      [
        makeEntry('2026-11-13', { mood: 1, updatedAt: 100 }),
        makeEntry('2026-11-13', { mood: 3, updatedAt: 300 }),
      ],
    );

    expect(result.next).toHaveLength(1);
    expect(result.next[0].mood).toBe(3);
  });
});

describe('запросы месяца', () => {
  it('в local-режиме не ходит на сервер', async () => {
    mockGetSyncMode.mockReturnValue('local');
    const { requestMonthHistory } = await loadHistory();

    expect(requestMonthHistory('2026-11')).toBe('idle');
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('в офлайне сообщает offline', async () => {
    mockIsOnline.mockReturnValue(false);
    const { requestMonthHistory, getMonthStatus, subscribeMonth } =
      await loadHistory();
    const listener = vi.fn();
    const unsubscribe = subscribeMonth('2026-11', listener);

    expect(requestMonthHistory('2026-11')).toBe('offline');
    expect(listener).toHaveBeenCalledWith('offline');
    expect(getMonthStatus('2026-11')).toBe('idle');
    unsubscribe();
  });

  it('загружает месяц, обновляет подписчиков и кэширует результат', async () => {
    const { requestMonthHistory, resolveMonthHistory, subscribeMonth } =
      await loadHistory();
    const listener = vi.fn();
    subscribeMonth('2026-11', listener);

    expect(requestMonthHistory('2026-11')).toBe('loading');
    expect(mockEmit).toHaveBeenCalledWith(
      'client:get_month_history',
      '2026-11',
    );
    expect(listener).toHaveBeenLastCalledWith('loading');

    resolveMonthHistory('2026-11', 'request-1');
    expect(listener).toHaveBeenLastCalledWith('loaded');

    // Повторный запрос отдаётся из кэша.
    expect(requestMonthHistory('2026-11')).toBe('loaded');
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  it('force игнорирует кэш и запрашивает месяц снова', async () => {
    const { requestMonthHistory, resolveMonthHistory } = await loadHistory();

    requestMonthHistory('2026-11');
    resolveMonthHistory('2026-11', 'request-1');
    expect(requestMonthHistory('2026-11', true)).toBe('loading');
    expect(mockEmit).toHaveBeenCalledTimes(2);
  });

  it('дожидается последнего из параллельных запросов', async () => {
    const {
      requestMonthHistory,
      resolveMonthHistory,
      rejectMonthHistory,
      subscribeMonth,
    } = await loadHistory();
    mockEmit.mockReturnValueOnce('request-1').mockReturnValueOnce('request-2');
    const listener = vi.fn();
    subscribeMonth('2026-11', listener);

    requestMonthHistory('2026-11', true);
    requestMonthHistory('2026-11', true);

    resolveMonthHistory('2026-11', 'request-1');
    expect(listener).toHaveBeenLastCalledWith('loading');

    resolveMonthHistory('2026-11', 'request-2');
    expect(listener).toHaveBeenLastCalledWith('loaded');

    // Ошибка без request_id снимает все ожидания, чтобы UI не завис.
    requestMonthHistory('2026-11', true);
    rejectMonthHistory(null);
    expect(listener).toHaveBeenLastCalledWith('error');
  });

  it('resetPendingMonthRequests помечает месяцы offline, retry повторяет запрос', async () => {
    const {
      requestMonthHistory,
      resetPendingMonthRequests,
      retryPendingMonths,
      subscribeMonth,
    } = await loadHistory();
    const listener = vi.fn();
    subscribeMonth('2026-11', listener);

    requestMonthHistory('2026-11');
    resetPendingMonthRequests();
    expect(listener).toHaveBeenLastCalledWith('offline');

    retryPendingMonths();
    expect(listener).toHaveBeenLastCalledWith('loading');
    expect(mockEmit).toHaveBeenCalledTimes(2);
  });
});

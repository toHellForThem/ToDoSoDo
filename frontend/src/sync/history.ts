/**
 * Кэш истории по месяцам.
 *
 * Календарь запрашивает месяц у сервера один раз за сессию; повторные
 * переключения берут данные из `rpgHistory`.  Если сервер недоступен,
 * UI показывает локальную историю и статус offline, а после reconnect
 * запрос повторяется.
 */

import { ClientEvent } from '../contract/events';
import { emit } from '../contract/socket';
import { getSyncMode, isOnline } from './client';

export type MonthHistoryStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'offline'
  | 'error';

type MonthListener = (status: MonthHistoryStatus) => void;

const loadedMonths = new Set<string>();
const pendingMonths = new Set<string>();
/** Месяцы, которые календарь уже показывал — их нужно повторить после reconnect. */
const requestedMonths = new Set<string>();
/** `request_id` → месяц, чтобы сопоставить ошибку сервера. */
const pendingRequests = new Map<string, string>();
const listeners = new Map<string, Set<MonthListener>>();

const notify = (month: string, status: MonthHistoryStatus): void => {
  listeners.get(month)?.forEach(listener => listener(status));
};

/** Ключ месяца в формате `YYYY-MM`, как его ждёт `client:get_month_history`. */
export const formatMonthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const getMonthStatus = (month: string): MonthHistoryStatus => {
  if (loadedMonths.has(month)) return 'loaded';
  if (pendingMonths.has(month)) return 'loading';
  return 'idle';
};

export const subscribeMonth = (
  month: string,
  listener: MonthListener
): (() => void) => {
  let bucket = listeners.get(month);
  if (!bucket) {
    bucket = new Set();
    listeners.set(month, bucket);
  }
  bucket.add(listener);

  return () => {
    bucket!.delete(listener);
    if (bucket!.size === 0) {
      listeners.delete(month);
    }
  };
};

/**
 * Запрашивает историю месяца.  Возвращает текущий статус, не дожидаясь
 * ответа сервера; обновления приходят подписчикам через `subscribeMonth`.
 */
export const requestMonthHistory = (
  month: string,
  force = false
): MonthHistoryStatus => {
  requestedMonths.add(month);

  if (!force && loadedMonths.has(month)) return 'loaded';
  if (!force && pendingMonths.has(month)) return 'loading';

  // В локальном режиме серверной истории нет — это не офлайн-ошибка.
  if (getSyncMode() !== 'auth') {
    notify(month, 'idle');
    return 'idle';
  }

  if (!isOnline()) {
    notify(month, 'offline');
    return 'offline';
  }

  const requestId = emit(ClientEvent.GET_MONTH_HISTORY, month);
  pendingRequests.set(requestId, month);
  pendingMonths.add(month);
  notify(month, 'loading');
  return 'loading';
};

export const resolveMonthHistory = (
  month: string,
  requestId?: string | null
): void => {
  if (requestId) {
    pendingRequests.delete(requestId);
  }
  loadedMonths.add(month);
  pendingMonths.delete(month);
  notify(month, 'loaded');
};

export const rejectMonthHistory = (requestId: string | null): void => {
  if (!requestId) return;
  const month = pendingRequests.get(requestId);
  if (!month) return;

  pendingRequests.delete(requestId);
  pendingMonths.delete(month);
  notify(month, 'error');
};

/**
 * Соединение потеряно: in-flight запросы уже не получат ответ, поэтому
 * их нужно считать незавершёнными и повторить после reconnect.
 */
export const resetPendingMonthRequests = (): void => {
  pendingMonths.forEach(month => notify(month, 'offline'));
  pendingMonths.clear();
  pendingRequests.clear();
};

/** Повторяет запросы, прерванные офлайном; вызывается после reconnect. */
export const retryPendingMonths = (): void => {
  requestedMonths.forEach(month => {
    if (!loadedMonths.has(month) && !pendingMonths.has(month)) {
      requestMonthHistory(month, true);
    }
  });
};

/**
 * Смена аккаунта/сессии: серверная история могла измениться, поэтому
 * загруженные месяцы перезапрашиваются.
 */
export const invalidateMonthHistory = (): void => {
  loadedMonths.clear();
  pendingMonths.clear();
  pendingRequests.clear();
  retryPendingMonths();
};

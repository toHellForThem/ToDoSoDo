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
import type { DailyHistory } from '../contract/types';
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

const hasPendingRequestFor = (month: string): boolean =>
  Array.from(pendingRequests.values()).includes(month);

export interface HistoryMergeResult {
  next: DailyHistory[];
  /** Локальные записи новее серверных — их нужно дослать на сервер. */
  localNewer: DailyHistory[];
  changed: boolean;
}

/**
 * Мерж серверной истории в локальную по `updatedAt` (last-write-wins).
 * Чистая функция, чтобы применять её через функциональный апдейтер стора.
 */
export const mergeHistoryEntries = (
  current: DailyHistory[],
  serverEntries: DailyHistory[]
): HistoryMergeResult => {
  const next = [...current];
  const localNewer: DailyHistory[] = [];
  let changed = false;

  // Бэкенд может прислать дубликаты за одну дату — берём самую свежую.
  const deduped = new Map<string, DailyHistory>();
  serverEntries.forEach(entry => {
    const existing = deduped.get(entry.date);
    if (!existing || (entry.updatedAt || 0) > (existing.updatedAt || 0)) {
      deduped.set(entry.date, entry);
    }
  });

  Array.from(deduped.values()).forEach(srvLog => {
    const localIdx = next.findIndex(h => h.date === srvLog.date);
    if (localIdx === -1) {
      next.push(srvLog);
      changed = true;
      return;
    }

    const localLog = next[localIdx];
    if ((srvLog.updatedAt || 0) >= (localLog.updatedAt || 0)) {
      if (
        srvLog.updatedAt !== localLog.updatedAt ||
        srvLog.mood !== localLog.mood ||
        srvLog.daily_progress !== localLog.daily_progress ||
        srvLog.pos_points !== localLog.pos_points ||
        srvLog.neg_points !== localLog.neg_points ||
        srvLog.habits_detail !== localLog.habits_detail
      ) {
        next[localIdx] = srvLog;
        changed = true;
      }
    } else {
      localNewer.push(localLog);
    }
  });

  return { next, localNewer, changed };
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

  // У месяца может быть несколько in-flight запросов (retry/reconnect).
  // Не показываем loaded, пока не ответил последний из них.
  if (hasPendingRequestFor(month)) return;

  loadedMonths.add(month);
  pendingMonths.delete(month);
  notify(month, 'loaded');
};

export const rejectMonthHistory = (requestId: string | null): void => {
  if (!requestId) {
    // Ошибка без request_id: не знаем, какой именно запрос упал, поэтому
    // снимаем все ожидания, чтобы UI не завис в loading.
    pendingMonths.forEach(month => notify(month, 'error'));
    pendingMonths.clear();
    pendingRequests.clear();
    return;
  }

  const month = pendingRequests.get(requestId);
  if (!month) return;

  pendingRequests.delete(requestId);

  // Другой запрос за тот же месяц ещё летит — ждём его результат.
  if (hasPendingRequestFor(month)) return;

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
  // Запросы предыдущего пользователя не должны уйти новому.
  requestedMonths.clear();

  // Активные календари перезапрашивают свой месяц уже под новой сессией.
  Array.from(listeners.keys()).forEach(month => {
    requestMonthHistory(month, true);
  });
};

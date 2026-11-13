/**
 * Побочные эффекты доменного стора: персистентность, сброс дня и
 * синхронизация дневной истории.  Сами действия живут в `appStore`.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  AuthStorage,
  RpgStorage,
  TodoStorage,
} from '../utils/storage';
import { send } from '../sync';
import { ClientEvent } from '../contract/events';
import {
  getLogicalDateStr,
  getNextResetMs,
} from '../utils/date';
import { computeDailyStats } from '../utils/dailyStats';
import { useAppStore } from '../store/appStore';

export const useTodoActions = () => {
  const todoList = useAppStore(state => state.todoList);
  const rpgHistory = useAppStore(state => state.rpgHistory);
  const settings = useAppStore(state => state.settings);
  const authMode = useAppStore(state => state.authMode);

  const isHistoryLoadedRef = useRef(!AuthStorage.getToken());
  const rpgHistoryRef = useRef(rpgHistory);
  const lastHistorySyncRef = useRef<string | null>(null);

  useEffect(() => {
    rpgHistoryRef.current = rpgHistory;
  }, [rpgHistory]);

  // Любое обновление истории (с сервера или из UI) означает, что её можно
  // отправлять обратно, не затирая серверные данные пустым локальным срезом.
  useEffect(
    () =>
      useAppStore.subscribe((state, prevState) => {
        if (state.rpgHistory !== prevState.rpgHistory) {
          isHistoryLoadedRef.current = true;
        }
      }),
    []
  );

  const resetHistorySync = useCallback(() => {
    lastHistorySyncRef.current = null;
  }, []);

  useEffect(() => {
    // Смена аккаунта/разлогин: при следующем входе историю нужно отправить заново.
    resetHistorySync();
  }, [authMode, resetHistorySync]);

  useEffect(() => {
    const timer = setTimeout(() => {
      TodoStorage.saveAll(todoList);
    }, 1000);
    return () => clearTimeout(timer);
  }, [todoList]);

  useEffect(() => {
    RpgStorage.saveHistory(rpgHistory);
  }, [rpgHistory]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextReset = () => {
      const resetEnabled = settings?.reset_enabled !== false;
      if (!resetEnabled) return;

      const resetTimeStr = settings?.reset_time || '00:00';
      const resetAt = getNextResetMs(resetTimeStr, settings?.timezone);
      const msUntilReset = Math.max(0, resetAt - Date.now());

      timerId = setTimeout(() => {
        useAppStore.getState().setTodoList(prev =>
          prev.map(item =>
            (item.type === 'daily' || item.type === 'habit') && !item.deleted
              ? { ...item, progressNow: 0, completed: false, updatedAt: resetAt }
              : item
          )
        );
        send(ClientEvent.CONFIRM_RESET, { type: 'daily', updatedAt: resetAt });
        send(ClientEvent.CONFIRM_RESET, { type: 'habit', updatedAt: resetAt });

        scheduleNextReset();
      }, msUntilReset);
    };

    scheduleNextReset();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [settings]);

  useEffect(() => {
    if (todoList.length === 0) return;
    if (!isHistoryLoadedRef.current) return;

    const todayStr = getLogicalDateStr(settings?.reset_time, settings?.timezone);
    const stats = computeDailyStats(todoList, todayStr);

    // Эмитим только когда реально изменились цифры дня, а не на каждое
    // изменение списка задач (переименование, порядок и т.п.).
    const signature = JSON.stringify({
      date: todayStr,
      daily_progress: stats.dailyProgress,
      pos_points: stats.posPoints,
      neg_points: stats.negPoints,
      habits_detail: stats.habitsDetail,
    });
    if (lastHistorySyncRef.current === signature) return;
    lastHistorySyncRef.current = signature;

    const existingEntry = rpgHistoryRef.current.find(h => h.date === todayStr);
    const updatedEntry = {
      date: todayStr,
      mood: existingEntry ? existingEntry.mood : null,
      daily_progress: stats.dailyProgress,
      pos_points: stats.posPoints,
      neg_points: stats.negPoints,
      habits_detail: stats.habitsDetail,
      updatedAt: Date.now(),
    };

    useAppStore.getState().setRpgHistory(prev => {
      const existingIndex = prev.findIndex(h => h.date === todayStr);
      if (existingIndex !== -1) {
        const newHistory = [...prev];
        newHistory[existingIndex] = updatedEntry;
        return newHistory;
      }
      return [...prev, updatedEntry];
    });

    send(ClientEvent.SYNC_DAILY_HISTORY, updatedEntry);
  }, [todoList, settings?.reset_time, settings?.timezone]);

  return { resetHistorySync };
};

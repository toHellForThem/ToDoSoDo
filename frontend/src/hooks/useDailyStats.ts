import { useMemo } from 'react';
import { computeDailyStats, type DailyStats } from '../domain/daily';
import { useAppStore } from '../store/appStore';
import { useLogicalDateStr } from './useLogicalDate';

/** Дневная статистика текущего логического дня. */
export const useDailyStats = (): DailyStats => {
  const todoList = useAppStore(state => state.todoList);
  const todayStr = useLogicalDateStr();

  return useMemo(
    () => computeDailyStats(todoList, todayStr),
    [todoList, todayStr]
  );
};

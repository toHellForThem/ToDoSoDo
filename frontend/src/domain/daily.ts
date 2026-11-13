/**
 * Дневная статистика: прогресс, очки привычек и снапшот для истории.
 *
 * Функции чистые и общие для `Header`, `RpgTab`, `DailyTab`, истории и
 * стора — все экраны показывают одинаковые цифры для одной логической даты.
 */

import type { Todo } from '../contract/types';
import { getLogicalDayIndex } from '../utils/date';
import {
  getProgressEnd,
  getProgressNow,
  isDailyScheduledForDay,
  toProgress,
} from './todo';

export interface HabitSnapshot {
  id: string;
  text: string;
  contribution: number;
  progressNow: number;
}

export interface DailyStats {
  dailyProgress: number;
  posPoints: number;
  negPoints: number;
  neutralPoints: number;
  habits: HabitSnapshot[];
  habitsDetail: string;
}

/** Разбирает `habits_detail` из истории в типизированный снапшот. */
export const parseHabitsDetail = (
  value: string | HabitSnapshot[] | null | undefined
): HabitSnapshot[] => {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => ({
      id: String(item.id),
      text: String(item.text ?? ''),
      contribution: Number(item.contribution) || 0,
      progressNow: toProgress(item.progressNow),
    }));
  } catch {
    return [];
  }
};

/** Снапшот привычек для истории: только ненулевой прогресс. */
export const buildHabitSnapshot = (todos: Todo[]): HabitSnapshot[] =>
  todos
    .filter(item => item.type === 'habit' && !item.deleted)
    .map(item => ({
      id: item.id,
      text: item.text,
      contribution: item.contribution,
      progressNow: getProgressNow(item),
    }));

export const computeDailyStats = (
  todos: Todo[],
  logicalDateStr: string
): DailyStats => {
  const logicalDayIdx = getLogicalDayIndex(logicalDateStr);

  const dailies = todos.filter(item =>
    isDailyScheduledForDay(item, logicalDayIdx)
  );
  const hasAnyDaily = todos.some(
    item => item.type === 'daily' && !item.deleted
  );

  let dailyProgress = 0.0;
  if (dailies.length > 0) {
    const { needProgress, nowProgress } = dailies.reduce(
      (acc, item) => {
        acc.needProgress += getProgressEnd(item);
        acc.nowProgress += getProgressNow(item);
        return acc;
      },
      { needProgress: 0, nowProgress: 0 }
    );
    dailyProgress = needProgress > 0 ? nowProgress / needProgress : 1.0;
  } else if (hasAnyDaily) {
    dailyProgress = 1.0;
  }

  const habits = buildHabitSnapshot(todos);

  const posPoints = habits
    .filter(item => item.contribution === 1)
    .reduce((sum, item) => sum + item.progressNow, 0);
  const negPoints = habits
    .filter(item => item.contribution === -1)
    .reduce((sum, item) => sum + item.progressNow, 0);
  const neutralPoints = habits
    .filter(item => item.contribution === 0)
    .reduce((sum, item) => sum + item.progressNow, 0);

  return {
    dailyProgress,
    posPoints,
    negPoints,
    neutralPoints,
    habits,
    habitsDetail: JSON.stringify(habits),
  };
};

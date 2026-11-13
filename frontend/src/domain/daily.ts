/**
 * Дневная статистика: прогресс, очки привычек и снапшот для истории.
 *
 * Функции чистые и общие для `Header`, `RpgTab`, `DailyTab`, истории и
 * стора — все экраны показывают одинаковые цифры для одной логической даты.
 */

import type { DailyHistory, Todo } from '../contract/types';
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

export interface HabitPoints {
  posPoints: number;
  negPoints: number;
  neutralPoints: number;
}

/**
 * Единый расчёт очков привычек.  Используется и для «живой» статистики
 * сегодняшнего дня, и для истории, чтобы прошлые дни считались так же.
 */
export const computeHabitPoints = (habits: HabitSnapshot[]): HabitPoints => {
  let posPoints = 0;
  let negPoints = 0;
  let neutralPoints = 0;

  habits.forEach(item => {
    if (item.contribution === 1) {
      posPoints += item.progressNow;
    } else if (item.contribution === -1) {
      negPoints += item.progressNow;
    } else if (item.contribution === 0) {
      neutralPoints += item.progressNow;
    }
  });

  return { posPoints, negPoints, neutralPoints };
};

/** Строит запись истории из той же статистики, что видят экраны. */
export const buildHistoryEntry = (
  date: string,
  stats: DailyStats,
  mood: number | null,
  updatedAt: number = Date.now(),
): DailyHistory => ({
  date,
  mood,
  daily_progress: stats.dailyProgress,
  pos_points: stats.posPoints,
  neg_points: stats.negPoints,
  habits_detail: stats.habitsDetail,
  updatedAt,
});

/** Разбирает `habits_detail` из истории в типизированный снапшот. */
export const parseHabitsDetail = (
  value: string | HabitSnapshot[] | null | undefined,
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
  logicalDateStr: string,
): DailyStats => {
  const logicalDayIdx = getLogicalDayIndex(logicalDateStr);

  const dailies = todos.filter(item =>
    isDailyScheduledForDay(item, logicalDayIdx),
  );

  let dailyProgress = 0.0;
  if (dailies.length > 0) {
    const { needProgress, nowProgress } = dailies.reduce(
      (acc, item) => {
        acc.needProgress += getProgressEnd(item);
        acc.nowProgress += getProgressNow(item);
        return acc;
      },
      { needProgress: 0, nowProgress: 0 },
    );
    dailyProgress = needProgress > 0 ? nowProgress / needProgress : 1.0;
  }

  const habits = buildHabitSnapshot(todos);
  const { posPoints, negPoints, neutralPoints } = computeHabitPoints(habits);

  return {
    dailyProgress,
    posPoints,
    negPoints,
    neutralPoints,
    habits,
    habitsDetail: JSON.stringify(habits),
  };
};

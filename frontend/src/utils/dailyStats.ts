import { Todo } from './storage';
import { getLogicalDayIndex } from './date';

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

const toProgress = (value: number | string): number =>
  parseInt(String(value), 10) || 0;

/**
 * Считает дневной прогресс и очки привычек по уже синхронизированному
 * списку задач.  Функция общая для `App`, `RpgTab` и истории, чтобы все
 * экраны показывали одинаковые цифры для одной логической даты.
 */
export const computeDailyStats = (
  todos: Todo[],
  logicalDateStr: string
): DailyStats => {
  const logicalDayIdx = getLogicalDayIndex(logicalDateStr);

  const dailies = todos.filter(item => {
    if (item.type !== 'daily' || item.deleted) return false;
    const daysStr = item.days || '1111111';
    return daysStr[logicalDayIdx] === '1';
  });

  const hasAnyDaily = todos.some(item => item.type === 'daily' && !item.deleted);

  let dailyProgress = 0.0;
  if (dailies.length > 0) {
    const { needProgress, nowProgress } = dailies.reduce(
      (acc, item) => {
        acc.needProgress += parseInt(String(item.progressEnd), 10) || 0;
        acc.nowProgress += toProgress(item.progressNow);
        return acc;
      },
      { needProgress: 0, nowProgress: 0 }
    );
    dailyProgress = needProgress > 0 ? nowProgress / needProgress : 1.0;
  } else if (hasAnyDaily) {
    dailyProgress = 1.0;
  }

  const habits = todos
    .filter(item => item.type === 'habit' && !item.deleted)
    .map(item => ({
      id: item.id,
      text: item.text,
      contribution: item.contribution,
      progressNow: toProgress(item.progressNow)
    }));

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
    habitsDetail: JSON.stringify(habits)
  };
};

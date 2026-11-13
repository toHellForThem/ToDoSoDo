/**
 * Чистые правила задач.
 *
 * Здесь живёт единственное определение прогресса и завершённости, чтобы
 * `Header`, `RpgTab`, `DailyTab`, история и стор считали одинаково.
 */

import type { Todo } from '../contract/types';

/** Приводит `progressNow`/`progressEnd` к числу, не падая на строках. */
export const toProgress = (value: number | string | null | undefined): number =>
  parseInt(String(value ?? 0), 10) || 0;

export const getProgressNow = (todo: Todo): number => toProgress(todo.progressNow);

export const getProgressEnd = (todo: Todo): number => toProgress(todo.progressEnd);

/**
 * Единое правило завершённости.
 *
 * - `tv_show`/`movie` хранят завершённость отдельным флагом;
 * - привычки не завершаются, у них только накопленный прогресс;
 * - остальные типы завершены, когда `progressNow >= progressEnd`.
 */
export const isTodoComplete = (todo: Todo): boolean => {
  if (todo.type === 'tv_show' || todo.type === 'movie') {
    return todo.completed;
  }
  if (todo.type === 'habit') {
    return false;
  }
  const end = getProgressEnd(todo);
  if (end <= 0) {
    return todo.completed;
  }
  return getProgressNow(todo) >= end;
};

/** Запланирована ли ежедневная задача на указанный день недели. */
export const isDailyScheduledForDay = (
  todo: Todo,
  dayIndex: number
): boolean => {
  if (todo.type !== 'daily' || todo.deleted) return false;
  const days = todo.days || '1111111';
  return days[dayIndex] === '1';
};

/** Доля выполнения задачи в диапазоне 0..1. */
export const getTodoProgressRatio = (todo: Todo): number => {
  const end = getProgressEnd(todo);
  if (end <= 0) return todo.completed ? 1 : 0;
  return Math.min(1, Math.max(0, getProgressNow(todo) / end));
};

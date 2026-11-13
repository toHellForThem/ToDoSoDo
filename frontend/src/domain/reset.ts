/**
 * Сброс ежедневных задач и привычек на новом логическом дне.
 *
 * Одна реализация для загрузки из хранилища, таймера сброса и приёма
 * `ALL_TODOS` с сервера.
 */

import type { Todo, TodoType } from '../contract/types';

export interface ResetResult {
  todos: Todo[];
  resetTypes: Set<TodoType>;
  changed: boolean;
}

const isResettable = (todo: Todo): boolean =>
  !todo.deleted && (todo.type === 'daily' || todo.type === 'habit');

/**
 * Сбрасывает задачу, если она не обновлялась с начала текущего дня.
 * Возвращает `null`, если сбрасывать нечего.
 */
export const resetTodoForNewDay = (
  todo: Todo,
  startOfToday: number,
): Todo | null => {
  if (!isResettable(todo) || todo.updatedAt >= startOfToday) return null;
  return {
    ...todo,
    progressNow: 0,
    completed: false,
    updatedAt: startOfToday,
  };
};

/** Сбрасывает все устаревшие daily/habit в списке. */
export const resetStaleTodos = (
  todos: Todo[],
  startOfToday: number,
): ResetResult => {
  const resetTypes = new Set<TodoType>();
  let changed = false;

  const next = todos.map(todo => {
    const reset = resetTodoForNewDay(todo, startOfToday);
    if (!reset) return todo;
    changed = true;
    resetTypes.add(todo.type);
    return reset;
  });

  return { todos: changed ? next : todos, resetTypes, changed };
};

/**
 * Безусловный сброс daily/habit при наступлении нового дня по таймеру.
 * `updatedAt` выставляется в момент сброса, чтобы сервер принял изменение.
 */
export const resetTodosForNewDay = (
  todos: Todo[],
  resetAt: number,
): ResetResult => {
  const resetTypes = new Set<TodoType>();
  let changed = false;

  const next = todos.map(todo => {
    if (!isResettable(todo)) return todo;
    changed = true;
    resetTypes.add(todo.type);
    return {
      ...todo,
      progressNow: 0,
      completed: false,
      updatedAt: resetAt,
    };
  });

  return { todos: changed ? next : todos, resetTypes, changed };
};

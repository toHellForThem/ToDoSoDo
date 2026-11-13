/**
 * Единый «видимый список» задач.
 *
 * Один и тот же фильтр используется для рендера табов, recycle-корзины и
 * навигации стрелками, чтобы порядок и состав списка не расходились.
 */

import type { Todo } from '../contract/types';

export type VisibleMainTab = 'todo' | 'daily' | 'rpg';
export type VisibleRpgSubtab =
  | 'dashboard'
  | 'habits'
  | 'piggy_bank'
  | 'tv_shows';

export interface TodoView {
  mainTab: VisibleMainTab;
  rpgSubtab: VisibleRpgSubtab;
  recycle: boolean;
  /** Индекс дня недели логической даты: 0 — понедельник. */
  dayIndex: number;
}

const sortByCompletion = (a: Todo, b: Todo): number => {
  if (a.completed && !b.completed) return 1;
  if (!a.completed && b.completed) return -1;
  return 0;
};

const isRpgType = (todo: Todo): boolean =>
  todo.type === 'habit' ||
  todo.type === 'piggy_bank' ||
  todo.type === 'tv_show' ||
  todo.type === 'movie';

/** Подходит ли задача текущему табу/подтабу и режиму recycle. */
export const isTodoVisible = (todo: Todo, view: TodoView): boolean => {
  const { mainTab, rpgSubtab, recycle, dayIndex } = view;

  if (recycle ? !todo.deleted : todo.deleted) return false;

  if (mainTab === 'todo') {
    return todo.type === 'todo';
  }

  if (mainTab === 'daily') {
    if (todo.type !== 'daily') return false;
    const days = todo.days || '1111111';
    return days[dayIndex] === '1';
  }

  if (rpgSubtab === 'habits') return todo.type === 'habit';
  if (rpgSubtab === 'piggy_bank') return todo.type === 'piggy_bank';
  if (rpgSubtab === 'tv_shows') {
    return todo.type === 'tv_show' || todo.type === 'movie';
  }

  // Dashboard в корзине показывает все RPG-типы.
  return recycle && isRpgType(todo);
};

/** Видимый список задач для указанного представления. */
export const selectVisibleTodos = (
  todos: Todo[],
  view: TodoView
): Todo[] => todos.filter(todo => isTodoVisible(todo, view)).sort(sortByCompletion);

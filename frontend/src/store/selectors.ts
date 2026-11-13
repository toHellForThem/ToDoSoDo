/**
 * Селекторы стора: производные данные, которые нужны нескольким экранам.
 */

import { DEFAULT_SHORTCUTS, type Todo } from '../utils/storage';
import { getLogicalDateStr, getLogicalDayIndex } from '../utils/date';
import { selectVisibleTodos, type TodoView } from '../domain/visibility';
import type { AppState } from './appStore';

/** Логическая дата текущего момента. */
export const selectTodayStr = (state: AppState): string =>
  getLogicalDateStr(state.settings?.reset_time, state.settings?.timezone);

/** Индекс дня недели текущей логической даты. */
export const selectTodayDayIndex = (state: AppState): number =>
  getLogicalDayIndex(selectTodayStr(state));

/**
 * Видимый список задач.  По умолчанию — текущий таб/подтаб и режим recycle;
 * `view` позволяет запросить список для другой колонки wide-layout.
 */
export const selectVisibleItems = (
  state: AppState,
  view: Partial<TodoView> = {},
): Todo[] => {
  const { activeView, mainTab, rpgSubtab, todoList } = state;
  // В настройках списка нет — стрелки не должны менять выделение.
  if (activeView === 'settings') return [];
  return selectVisibleTodos(todoList, {
    mainTab: view.mainTab ?? mainTab,
    rpgSubtab: view.rpgSubtab ?? rpgSubtab,
    recycle: view.recycle ?? activeView === 'recycle',
    dayIndex: view.dayIndex ?? selectTodayDayIndex(state),
  });
};

/** Задачи, которые видны в текущем табе/подтабе и режиме recycle. */
export const selectActiveItems = (state: AppState): Todo[] =>
  selectVisibleItems(state);

export const selectShortcuts = (state: AppState) =>
  state.settings?.shortcuts || DEFAULT_SHORTCUTS;

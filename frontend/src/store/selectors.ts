/**
 * Селекторы стора: производные данные, которые нужны нескольким экранам.
 */

import { DEFAULT_SHORTCUTS, type Todo } from '../utils/storage';
import { getLogicalDateStr, getLogicalDayIndex } from '../utils/date';
import type { AppState } from './appStore';

const sortByCompletion = (a: Todo, b: Todo): number => {
  if (a.completed && !b.completed) return 1;
  if (!a.completed && b.completed) return -1;
  return 0;
};

/** Задачи, которые видны в текущем табе/подтабе и режиме recycle. */
export const selectActiveItems = (state: AppState): Todo[] => {
  const { activeView, mainTab, rpgSubtab, todoList, settings } = state;
  if (activeView !== 'list' && activeView !== 'recycle') return [];

  const isRecycle = activeView === 'recycle';

  if (mainTab === 'todo') {
    return todoList
      .filter(
        item => item.type === 'todo' && (isRecycle ? item.deleted : !item.deleted)
      )
      .sort(sortByCompletion);
  }

  if (mainTab === 'daily') {
    const todayDayIdx = getLogicalDayIndex(
      getLogicalDateStr(settings?.reset_time, settings?.timezone)
    );
    return todoList
      .filter(item => {
        if (item.type !== 'daily' || (isRecycle ? !item.deleted : item.deleted)) {
          return false;
        }
        const daysStr = item.days || '1111111';
        return daysStr[todayDayIdx] === '1';
      })
      .sort(sortByCompletion);
  }

  if (mainTab === 'rpg') {
    if (rpgSubtab === 'habits') {
      return todoList.filter(
        item => item.type === 'habit' && (isRecycle ? item.deleted : !item.deleted)
      );
    }
    if (rpgSubtab === 'piggy_bank') {
      return todoList.filter(
        item =>
          item.type === 'piggy_bank' && (isRecycle ? item.deleted : !item.deleted)
      );
    }
    if (rpgSubtab === 'tv_shows') {
      return todoList.filter(
        item =>
          (item.type === 'tv_show' || item.type === 'movie') &&
          (isRecycle ? item.deleted : !item.deleted)
      );
    }
  }

  return [];
};

export const selectShortcuts = (state: AppState) =>
  state.settings?.shortcuts || DEFAULT_SHORTCUTS;

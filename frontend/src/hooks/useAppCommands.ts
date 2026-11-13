import { useMemo } from 'react';
import type { Command } from '../commands';
import { useAppStore } from '../store/appStore';
import { selectActiveItems } from '../store/selectors';
import { send } from '../sync';
import { ClientEvent } from '../contract/events';
import type { ShortcutSettings } from '../utils/storage';

interface AppCommandsOptions {
  shortcuts: ShortcutSettings | undefined;
  isMoodSheetOpen: boolean;
  closeMoodSheet: () => void;
  handleMoodSheet: () => void;
  handleBackAction: () => boolean;
  focusActiveInput: () => void;
}

/**
 * Глобальные команды и шорткаты приложения: навигация, выбор и действия
 * над элементами списка, шторка настроения.
 */
export const useAppCommands = ({
  shortcuts,
  isMoodSheetOpen,
  closeMoodSheet,
  handleMoodSheet,
  handleBackAction,
  focusActiveInput,
}: AppCommandsOptions): Command[] => {
  const mainTab = useAppStore(state => state.mainTab);
  const activeView = useAppStore(state => state.activeView);
  const selectedTaskId = useAppStore(state => state.selectedTaskId);
  const setSelectedTaskId = useAppStore(state => state.setSelectedTaskId);
  const handleTabChange = useAppStore(state => state.handleTabChange);
  const handleSubtabChange = useAppStore(state => state.handleSubtabChange);
  const toggleActiveView = useAppStore(state => state.toggleActiveView);
  const toggleCalendar = useAppStore(state => state.toggleCalendar);
  const handleMoodChange = useAppStore(state => state.handleMoodChange);
  const statusChangeTask = useAppStore(state => state.statusChangeTask);
  const deleteTodo = useAppStore(state => state.deleteTodo);
  const handleDeleteTodo = useAppStore(state => state.handleDeleteTodo);
  const setTodoList = useAppStore(state => state.setTodoList);

  return useMemo<Command[]>(() => {
    const list: Command[] = [];
    const add = (
      id: string,
      title: string,
      shortcut: string | undefined,
      scope: Command['scope'],
      run: Command['run'],
      when?: Command['when']
    ) => {
      if (!shortcut) return;
      list.push({ id, title, shortcut, scope, run, when });
    };

    add('tab.rpg', 'RPG tab', shortcuts?.rpg_tab, 'global', () => handleTabChange('rpg'));
    add('tab.todo', 'To-do tab', shortcuts?.todo_tab, 'global', () => handleTabChange('todo'));
    add('tab.daily', 'Daily tab', shortcuts?.daily_tab, 'global', () => handleTabChange('daily'));
    add('subtab.habits', 'Habits subtab', shortcuts?.habits_subtab, 'global', () => handleSubtabChange('habits'));
    add('subtab.piggy', 'Piggy bank subtab', shortcuts?.piggy_subtab, 'global', () => handleSubtabChange('piggy_bank'));
    add('subtab.tv', 'TV shows subtab', shortcuts?.tv_subtab, 'global', () => handleSubtabChange('tv_shows'));
    add('view.recycle', 'Recycle view', shortcuts?.recycle_view, 'global', () => toggleActiveView('recycle'));
    add('view.settings', 'Settings view', shortcuts?.settings_view, 'global', () => toggleActiveView('settings'));
    add('view.calendar', 'Calendar view', shortcuts?.calendar_view, 'global', () => toggleCalendar());
    add('view.mood', 'Mood view', shortcuts?.mood_view, 'global', () => handleMoodSheet());

    add('nav.back', 'Back', 'escape', 'global', () => handleBackAction());

    if (isMoodSheetOpen) {
      add('mood.1', 'Mood 1', '1', 'modal', () => { handleMoodChange(1); closeMoodSheet(); });
      add('mood.2', 'Mood 2', '2', 'modal', () => { handleMoodChange(2); closeMoodSheet(); });
      add('mood.3', 'Mood 3', '3', 'modal', () => { handleMoodChange(3); closeMoodSheet(); });
      add('mood.4', 'Mood 4', '4', 'modal', () => { handleMoodChange(4); closeMoodSheet(); });
      add('mood.5', 'Mood 5', '5', 'modal', () => { handleMoodChange(5); closeMoodSheet(); });
    }

    const getActiveItems = () => selectActiveItems(useAppStore.getState());
    const listScope = mainTab;

    add('list.next', 'Next item', 'arrowdown', listScope, () => {
      const items = getActiveItems();
      if (items.length === 0) return;
      const currentIndex = items.findIndex(item => item.id === selectedTaskId);
      if (currentIndex === -1) {
        setSelectedTaskId(items[0].id);
      } else if (currentIndex === items.length - 1) {
        setSelectedTaskId(items[0].id);
      } else {
        setSelectedTaskId(items[currentIndex + 1].id);
      }
    });

    add('list.prev', 'Previous item', 'arrowup', listScope, () => {
      const items = getActiveItems();
      if (items.length === 0) return;
      const currentIndex = items.findIndex(item => item.id === selectedTaskId);
      if (currentIndex === -1) {
        setSelectedTaskId(items[items.length - 1].id);
      } else if (currentIndex === 0) {
        setSelectedTaskId(items[items.length - 1].id);
      } else {
        setSelectedTaskId(items[currentIndex - 1].id);
      }
    });

    const handleToggleSelected = () => {
      if (!selectedTaskId) return;
      const items = getActiveItems();
      const selectedItem = items.find(item => item.id === selectedTaskId);
      if (!selectedItem) return;

      if (activeView === 'recycle') {
        const index = items.findIndex(item => item.id === selectedTaskId);
        let nextSelectedId: string | null = null;
        if (items.length > 1) {
          if (index === items.length - 1) {
            nextSelectedId = items[index - 1].id;
          } else {
            nextSelectedId = items[index + 1].id;
          }
        }
        let updated = null;
        setTodoList(prev => {
          return prev.map(todo => {
            if (todo.id === selectedTaskId) {
              updated = { ...todo, deleted: false, updatedAt: Date.now() };
              return updated;
            }
            return todo;
          });
        });
        if (updated) {
          send(ClientEvent.SYNC_TODO, updated);
        }
        setSelectedTaskId(nextSelectedId);
        return;
      }

      if (selectedItem.type === 'todo') {
        statusChangeTask(selectedTaskId, 1);
      } else if (selectedItem.type === 'daily') {
        statusChangeTask(selectedTaskId);
      } else if (selectedItem.type === 'habit') {
        statusChangeTask(selectedTaskId);
      } else if (selectedItem.type === 'tv_show') {
        statusChangeTask(selectedTaskId, 1, 'episode');
      } else if (selectedItem.type === 'movie') {
        statusChangeTask(selectedTaskId);
      } else if (selectedItem.type === 'piggy_bank') {
        statusChangeTask(selectedTaskId, 1);
      }
    };
    add('list.toggle', 'Toggle item', 'enter', listScope, handleToggleSelected);
    add('list.toggle.space', 'Toggle item', 'space', listScope, handleToggleSelected);

    add('list.delete', 'Delete item', 'arrowright', listScope, () => {
      if (!selectedTaskId) return;
      const items = getActiveItems();
      const index = items.findIndex(item => item.id === selectedTaskId);
      if (index === -1) return;

      let nextSelectedId: string | null = null;
      if (items.length > 1) {
        if (index === items.length - 1) {
          nextSelectedId = items[index - 1].id;
        } else {
          nextSelectedId = items[index + 1].id;
        }
      }
      if (activeView === 'recycle') {
        deleteTodo(selectedTaskId);
      } else {
        handleDeleteTodo(selectedTaskId);
      }
      setSelectedTaskId(nextSelectedId);
    });

    add('list.decrement', 'Decrement item', 'backspace', listScope, () => {
      if (!selectedTaskId) return;
      const items = getActiveItems();
      const selectedItem = items.find(item => item.id === selectedTaskId);
      if (!selectedItem) return;
      if (selectedItem.type === 'habit') {
        statusChangeTask(selectedTaskId, 'reset');
      } else if (selectedItem.type === 'piggy_bank') {
        statusChangeTask(selectedTaskId, -1);
      } else if (selectedItem.type === 'tv_show') {
        statusChangeTask(selectedTaskId, -1, 'episode');
      }
    });

    add('focus.activeInput', 'Focus active input', 'i', 'global', () => {
      focusActiveInput();
    });

    return list;
  }, [
    shortcuts,
    isMoodSheetOpen,
    selectedTaskId,
    mainTab,
    handleTabChange,
    handleSubtabChange,
    toggleActiveView,
    toggleCalendar,
    handleMoodSheet,
    handleBackAction,
    handleMoodChange,
    closeMoodSheet,
    statusChangeTask,
    handleDeleteTodo,
    deleteTodo,
    setTodoList,
    setSelectedTaskId,
    activeView,
    focusActiveInput,
  ]);
};

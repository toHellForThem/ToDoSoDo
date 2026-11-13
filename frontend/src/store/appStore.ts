/**
 * Единый стор приложения.
 *
 * Держит доменные данные (`todos`, `history`, `settings`, `auth`) и
 * UI-состояние (`navigation`, `selection`, модалки).  Компоненты читают
 * нужные срезы через селекторы, а не получают десятки пропсов из `App`.
 */

import { Keyboard } from 'react-native';
import { create } from 'zustand';
import {
  AuthStorage,
  RpgStorage,
  TodoStorage,
  TombstoneStorage,
  type AuthMode,
  type RpgHistoryItem,
  type Todo,
  type TodoType,
  type UserSettings,
} from '../utils/storage';
import { send } from '../sync';
import { ClientEvent } from '../contract/events';
import {
  getLogicalDateStr,
  getLogicalDayStartMs,
} from '../utils/date';
import { buildHistoryEntry, computeDailyStats } from '../domain/daily';
import { resetStaleTodos } from '../domain/reset';
import {
  getProgressEnd,
  getProgressNow,
  isTodoComplete,
} from '../domain/todo';

export type MainTab = 'todo' | 'daily' | 'rpg';
export type RpgSubtab = 'dashboard' | 'habits' | 'piggy_bank' | 'tv_shows';
export type ActiveView = 'list' | 'recycle' | 'settings';

type Updater<T> = T | ((prev: T) => T);

const resolveUpdater = <T,>(value: Updater<T>, prev: T): T =>
  typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;

const isMainTab = (value: unknown): value is MainTab =>
  value === 'todo' || value === 'daily' || value === 'rpg';

/** Сервер может прислать неизвестный таб — не даём экрану стать пустым. */
export const normalizeMainTab = (value: unknown): MainTab =>
  isMainTab(value) ? value : 'todo';

const isRpgSubtab = (value: string | undefined): value is RpgSubtab =>
  value === 'dashboard' ||
  value === 'habits' ||
  value === 'piggy_bank' ||
  value === 'tv_shows';

const loadInitialTodos = (): Todo[] => {
  const local = TodoStorage.getAll();
  const list = Array.isArray(local) ? local : [];
  const localSettings = AuthStorage.getSettings();

  if (localSettings?.reset_enabled === false) {
    return list;
  }

  const startOfToday = getLogicalDayStartMs(
    localSettings?.reset_time,
    localSettings?.timezone
  );

  const { todos, changed } = resetStaleTodos(list, startOfToday);
  if (changed) {
    TodoStorage.saveAll(todos);
  }
  return todos;
};

const applyStatusChange = (
  todo: Todo,
  amount: number | 'reset' | 'toggle_complete',
  field: string
): Todo => {
  const type = todo.type;

  if (type === 'habit') {
    if (amount === 'reset') {
      return { ...todo, progressNow: 0, completed: false, updatedAt: Date.now() };
    }
    const change = Math.abs(amount as number);
    const newProgress = Math.max(0, getProgressNow(todo) + change);
    return {
      ...todo,
      progressNow: newProgress,
      completed: false,
      updatedAt: Date.now(),
    };
  }

  if (type === 'piggy_bank') {
    const change = amount as number;
    const newProgress = Math.max(0, getProgressNow(todo) + change);
    const updated: Todo = {
      ...todo,
      progressNow: newProgress,
      updatedAt: Date.now(),
    };
    return { ...updated, completed: isTodoComplete(updated) };
  }

  if (type === 'tv_show') {
    // Сброс дня не должен трогать сериалы и их флаг выполненности.
    if (amount === 'reset') return todo;
    if (amount === 'toggle_complete') {
      return { ...todo, completed: !todo.completed, updatedAt: Date.now() };
    }
    let [season, episode] = (todo.progressNow || '1-1')
      .toString()
      .split('-')
      .map(Number);
    if (isNaN(season)) season = 1;
    if (isNaN(episode)) episode = 1;

    const change = amount as number;
    if (field === 'season') {
      season = Math.max(1, season + change);
    } else {
      episode = Math.max(1, episode + change);
    }

    return {
      ...todo,
      progressNow: `${season}-${episode}`,
      updatedAt: Date.now(),
    };
  }

  if (type === 'movie') {
    // Сброс дня не должен трогать фильмы и их флаг выполненности.
    if (amount === 'reset') return todo;
    const wasCompleted = todo.completed;
    return {
      ...todo,
      completed: !wasCompleted,
      progressNow: !wasCompleted ? '1' : '0',
      updatedAt: Date.now(),
    };
  }

  if (todo.completed) {
    return {
      ...todo,
      progressNow: 0,
      completed: false,
      contribution: 0,
      updatedAt: Date.now(),
    };
  }

  if (getProgressEnd(todo) > 1) {
    const nextProgress = getProgressNow(todo) + 1;
    const updated: Todo = {
      ...todo,
      progressNow: nextProgress,
      contribution: todo.type === 'daily' ? nextProgress : todo.contribution,
      updatedAt: Date.now(),
    };
    return { ...updated, completed: isTodoComplete(updated) };
  }

  return {
    ...todo,
    progressNow: 1,
    completed: true,
    contribution: todo.type === 'daily' ? 1 : todo.contribution,
    updatedAt: Date.now(),
  };
};

const initialSettings = AuthStorage.getSettings();

let flashTimer: ReturnType<typeof setTimeout> | null = null;

export interface AppState {
  // Доменные данные
  settings: UserSettings;
  authMode: AuthMode;
  authState: string;
  todoList: Todo[];
  rpgHistory: RpgHistoryItem[];
  /** История с сервера загружена — можно безопасно отправлять локальные цифры. */
  historyLoaded: boolean;

  // Навигация
  mainTab: MainTab;
  rpgSubtab: RpgSubtab;
  activeView: ActiveView;
  isCalendarVisible: boolean;

  // Выделение и фокус
  selectedTaskId: string | null;

  // UI-состояние
  focusedGoalId: string | null;
  flashingGoalId: string | null;
  piggyInputs: Record<string, string>;
  showIsMovie: boolean;
  showStartEpisode: string;
  dailyDays: string;
  dailyProgressEnd: number;
  isMoodSheetOpen: boolean;

  // Доменные действия
  setSettings: (settings: UserSettings) => void;
  setAuthMode: (mode: AuthMode) => void;
  setAuthState: (state: string) => void;
  setTodoList: (value: Updater<Todo[]>) => void;
  setRpgHistory: (value: Updater<RpgHistoryItem[]>) => void;
  setHistoryLoaded: (loaded: boolean) => void;
  addTask: (
    task: string,
    progressEnd?: number,
    type?: TodoType,
    progressNow?: number | string,
    contribution?: number,
    days?: string
  ) => void;
  deleteToRecycle: (id: string) => void;
  handleDeleteTodo: (id: string) => void;
  statusChangeTask: (
    id: string,
    amount?: number | 'reset' | 'toggle_complete',
    field?: string
  ) => void;
  deleteTodo: (id: string) => void;
  editTask: (id: string, updatedFields: Partial<Todo>) => void;
  handleMoodChange: (moodValue: number) => void;

  // Навигация
  setMainTab: (tab: MainTab) => void;
  setRpgSubtab: (subtab: RpgSubtab) => void;
  setActiveView: (view: ActiveView) => void;
  toggleActiveView: (view: ActiveView) => void;
  handleTabChange: (tab: MainTab) => void;
  handleSubtabChange: (subtab: RpgSubtab) => void;
  setCalendarVisible: (visible: boolean) => void;
  toggleCalendar: () => void;

  // Выделение и фокус
  setSelectedTaskId: (id: string | null) => void;

  // UI-состояние
  setFocusedGoalId: (value: Updater<string | null>) => void;
  setFlashingGoalId: (id: string | null) => void;
  setPiggyInputs: (value: Updater<Record<string, string>>) => void;
  setShowIsMovie: (value: Updater<boolean>) => void;
  setShowStartEpisode: (value: Updater<string>) => void;
  setDailyDays: (value: Updater<string>) => void;
  setDailyProgressEnd: (value: Updater<number>) => void;
  setIsMoodSheetOpen: (open: boolean) => void;
  handleUpdatePiggy: (goalId: string, inputVal: number, isAdd: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: initialSettings,
  authMode: 'local',
  authState: '',
  todoList: loadInitialTodos(),
  rpgHistory: RpgStorage.getHistory(),
  historyLoaded: false,

  mainTab: normalizeMainTab(initialSettings.main_page),
  rpgSubtab: isRpgSubtab(initialSettings.rpg_subtab)
    ? initialSettings.rpg_subtab
    : 'dashboard',
  activeView: 'list',
  isCalendarVisible: false,

  selectedTaskId: null,

  focusedGoalId: null,
  flashingGoalId: null,
  piggyInputs: {},
  showIsMovie: false,
  showStartEpisode: '1',
  dailyDays: '1111111',
  dailyProgressEnd: 1,
  isMoodSheetOpen: false,

  setSettings: settings => set({ settings }),
  setAuthMode: authMode => set({ authMode }),
  setAuthState: authState => set({ authState }),
  setTodoList: value =>
    set(state => ({ todoList: resolveUpdater(value, state.todoList) })),
  setRpgHistory: value =>
    set(state => ({ rpgHistory: resolveUpdater(value, state.rpgHistory) })),
  setHistoryLoaded: historyLoaded => set({ historyLoaded }),

  addTask: (
    task,
    progressEnd = 1,
    type,
    progressNow = 0,
    contribution = 0,
    days = '1111111'
  ) => {
    if (!task.trim()) return;

    const { mainTab, todoList } = get();
    const todoType = type ?? (mainTab as TodoType);
    let defaultContrib = contribution;
    if (defaultContrib === 0 && (todoType === 'todo' || todoType === mainTab)) {
      defaultContrib = 1;
    }

    const newTodo: Todo = {
      id: Date.now().toString(),
      text: task.trim(),
      completed: false,
      deleted: false,
      updatedAt: Date.now(),
      type: todoType,
      progressNow,
      progressEnd,
      contribution: defaultContrib,
      days,
    };

    set({ todoList: [newTodo, ...todoList] });
    send(ClientEvent.SYNC_TODO, newTodo);
  },

  deleteToRecycle: id => {
    const { todoList } = get();
    const target = todoList.find(todo => todo.id === id);
    if (!target) return;

    const updated: Todo = { ...target, deleted: true, updatedAt: Date.now() };
    set({
      todoList: todoList.map(todo => (todo.id === id ? updated : todo)),
    });
    send(ClientEvent.SYNC_TODO, updated);
  },

  handleDeleteTodo: id => {
    const { settings, deleteToRecycle, deleteTodo } = get();
    if (settings.soft_delete) {
      deleteToRecycle(id);
    } else {
      deleteTodo(id);
    }
  },

  statusChangeTask: (id, amount = 1, field = 'episode') => {
    const { todoList } = get();
    const target = todoList.find(todo => todo.id === id);
    if (!target) return;

    const updated = applyStatusChange(target, amount, field);
    set({
      todoList: todoList.map(todo => (todo.id === id ? updated : todo)),
    });
    send(ClientEvent.SYNC_TODO, updated);
  },

  deleteTodo: id => {
    const { todoList } = get();
    set({ todoList: todoList.filter(item => item.id !== id) });
    // Жёсткое удаление фиксируем локально, чтобы офлайн-удаление
    // не потерялось и дослалось на сервер при reconnect.
    TombstoneStorage.add(id);
    send(ClientEvent.DELETE_TODO, id);
  },

  editTask: (id, updatedFields) => {
    const { todoList } = get();
    const target = todoList.find(todo => todo.id === id);
    if (!target) return;

    const merged: Todo = { ...target, ...updatedFields, updatedAt: Date.now() };
    if ('progressEnd' in updatedFields || 'progressNow' in updatedFields) {
      merged.completed = isTodoComplete(merged);
    }

    set({
      todoList: todoList.map(todo => (todo.id === id ? merged : todo)),
    });
    send(ClientEvent.SYNC_TODO, merged);
  },

  handleMoodChange: moodValue => {
    const { settings, todoList, rpgHistory } = get();
    const todayStr = getLogicalDateStr(settings?.reset_time, settings?.timezone);
    const stats = computeDailyStats(todoList, todayStr);

    const existingIndex = rpgHistory.findIndex(h => h.date === todayStr);
    const updatedEntry: RpgHistoryItem = buildHistoryEntry(
      todayStr,
      stats,
      moodValue
    );

    const newHistory = [...rpgHistory];
    if (existingIndex !== -1) {
      newHistory[existingIndex] = updatedEntry;
    } else {
      newHistory.push(updatedEntry);
    }

    set({ rpgHistory: newHistory });
    send(ClientEvent.SYNC_DAILY_HISTORY, updatedEntry);
  },

  setMainTab: tab => set({ mainTab: normalizeMainTab(tab) }),
  setRpgSubtab: rpgSubtab => set({ rpgSubtab, focusedGoalId: null }),
  setActiveView: activeView => set({ activeView }),
  toggleActiveView: view =>
    set(state => ({
      activeView: state.activeView === view ? 'list' : view,
      selectedTaskId: null,
    })),
  handleTabChange: tab =>
    set(state => ({
      mainTab: normalizeMainTab(tab),
      rpgSubtab: tab === 'rpg' ? 'dashboard' : state.rpgSubtab,
      activeView: 'list',
      focusedGoalId: null,
      selectedTaskId: null,
    })),
  handleSubtabChange: subtab =>
    set({
      mainTab: 'rpg',
      rpgSubtab: subtab,
      activeView: 'list',
      selectedTaskId: null,
    }),
  setCalendarVisible: isCalendarVisible => set({ isCalendarVisible }),
  toggleCalendar: () =>
    set(state => ({
      isCalendarVisible: !state.isCalendarVisible,
      mainTab: 'rpg',
      rpgSubtab: 'dashboard',
      activeView: 'list',
      selectedTaskId: null,
    })),

  setSelectedTaskId: selectedTaskId => set({ selectedTaskId }),

  setFocusedGoalId: value =>
    set(state => ({
      focusedGoalId: resolveUpdater(value, state.focusedGoalId),
    })),
  setFlashingGoalId: flashingGoalId => set({ flashingGoalId }),
  setPiggyInputs: value =>
    set(state => ({ piggyInputs: resolveUpdater(value, state.piggyInputs) })),
  setShowIsMovie: value =>
    set(state => ({ showIsMovie: resolveUpdater(value, state.showIsMovie) })),
  setShowStartEpisode: value =>
    set(state => ({
      showStartEpisode: resolveUpdater(value, state.showStartEpisode),
    })),
  setDailyDays: value =>
    set(state => ({ dailyDays: resolveUpdater(value, state.dailyDays) })),
  setDailyProgressEnd: value =>
    set(state => ({
      dailyProgressEnd: resolveUpdater(value, state.dailyProgressEnd),
    })),
  setIsMoodSheetOpen: isMoodSheetOpen => set({ isMoodSheetOpen }),

  handleUpdatePiggy: (goalId, inputVal, isAdd) => {
    get().statusChangeTask(goalId, isAdd ? inputVal : -inputVal);
    Keyboard.dismiss();

    if (flashTimer) {
      clearTimeout(flashTimer);
    }
    set({ flashingGoalId: goalId });
    flashTimer = setTimeout(() => {
      set({ flashingGoalId: null });
      flashTimer = null;
    }, 650);
  },
}));

import { describe, expect, it, vi } from 'vitest';
/**
 * Селекторы видимого списка: табы, подтабы, корзина и сортировка.
 */

import type { Todo } from '../../contract/types';
import type { AppState } from '../appStore';
import {
  selectActiveItems,
  selectShortcuts,
  selectTodayDayIndex,
  selectTodayStr,
  selectVisibleItems,
} from '../selectors';

// Нативное хранилище в Node недоступно: селекторам нужны только дефолты.
vi.mock('../../utils/storage', () => ({
  DEFAULT_SHORTCUTS: { todo_tab: 'mod+2' },
}));

const makeTodo = (
  id: string,
  type: Todo['type'],
  overrides: Partial<Todo> = {},
): Todo => ({
  id,
  text: id,
  completed: false,
  deleted: false,
  updatedAt: 1,
  type,
  progressNow: 0,
  progressEnd: 1,
  contribution: 1,
  days: '1111111',
  ...overrides,
});

const makeState = (overrides: Partial<AppState> = {}): AppState =>
  ({
    settings: {
      reset_time: '00:00',
      timezone: 'UTC',
      shortcuts: { todo_tab: 'mod+2' },
    },
    activeView: 'list',
    mainTab: 'todo',
    rpgSubtab: 'dashboard',
    todoList: [],
    ...overrides,
  }) as unknown as AppState;

describe('selectVisibleItems', () => {
  const todos = [
    makeTodo('todo', 'todo'),
    makeTodo('daily', 'daily'),
    makeTodo('habit', 'habit'),
    makeTodo('piggy', 'piggy_bank'),
    makeTodo('show', 'tv_show'),
    makeTodo('movie', 'movie'),
    makeTodo('deleted-todo', 'todo', { deleted: true }),
  ];

  it('показывает todo-задачи текущего таба', () => {
    expect(
      selectVisibleItems(makeState({ todoList: todos })).map(t => t.id),
    ).toEqual(['todo']);
  });

  it('в корзине показывает только удалённые задачи', () => {
    const state = makeState({ todoList: todos, activeView: 'recycle' });
    expect(selectVisibleItems(state).map(t => t.id)).toEqual(['deleted-todo']);
  });

  it('в настройках списка нет', () => {
    expect(
      selectVisibleItems(
        makeState({ todoList: todos, activeView: 'settings' }),
      ),
    ).toEqual([]);
  });

  it('daily фильтрует по дню недели', () => {
    const daily = makeTodo('mon', 'daily', { days: '1000000' });
    const state = makeState({
      todoList: [daily, makeTodo('any', 'daily')],
      mainTab: 'daily',
    });

    expect(selectVisibleItems(state, { dayIndex: 0 }).map(t => t.id)).toEqual([
      'mon',
      'any',
    ]);
    expect(selectVisibleItems(state, { dayIndex: 1 }).map(t => t.id)).toEqual([
      'any',
    ]);
  });

  it('в корзине daily видны независимо от расписания', () => {
    const state = makeState({
      todoList: [makeTodo('mon', 'daily', { days: '1000000', deleted: true })],
      mainTab: 'daily',
      activeView: 'recycle',
    });

    expect(selectVisibleItems(state, { dayIndex: 5 })).toHaveLength(1);
  });

  it('разделяет RPG-подтабы по типу', () => {
    const state = makeState({ todoList: todos, mainTab: 'rpg' });

    expect(
      selectVisibleItems(state, { rpgSubtab: 'habits' }).map(t => t.id),
    ).toEqual(['habit']);
    expect(
      selectVisibleItems(state, { rpgSubtab: 'piggy_bank' }).map(t => t.id),
    ).toEqual(['piggy']);
    expect(
      selectVisibleItems(state, { rpgSubtab: 'tv_shows' }).map(t => t.id),
    ).toEqual(['show', 'movie']);
    expect(selectVisibleItems(state, { rpgSubtab: 'dashboard' })).toEqual([]);
  });

  it('dashboard в корзине показывает все RPG-типы', () => {
    const deletedRpg = [
      makeTodo('habit', 'habit', { deleted: true }),
      makeTodo('show', 'tv_show', { deleted: true }),
    ];
    const state = makeState({
      todoList: deletedRpg,
      mainTab: 'rpg',
      rpgSubtab: 'dashboard',
      activeView: 'recycle',
    });

    expect(selectVisibleItems(state)).toHaveLength(2);
  });

  it('выполненные задачи идут в конце', () => {
    const state = makeState({
      todoList: [
        makeTodo('done', 'todo', { completed: true }),
        makeTodo('open', 'todo'),
      ],
    });

    expect(selectActiveItems(state).map(t => t.id)).toEqual(['open', 'done']);
  });
});

describe('selectTodayStr / selectTodayDayIndex / selectShortcuts', () => {
  it('использует настройки сброса и шорткатов', () => {
    const state = makeState({
      settings: makeState().settings,
    } as Partial<AppState>);

    expect(selectTodayStr(state)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(selectTodayDayIndex(state)).toBeGreaterThanOrEqual(0);
    expect(selectShortcuts(state)).toEqual({ todo_tab: 'mod+2' });
  });
});

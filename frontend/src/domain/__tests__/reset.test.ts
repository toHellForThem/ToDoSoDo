import { describe, expect, it } from 'vitest';
/**
 * Сброс ежедневных задач и привычек на новом логическом дне.
 */

import type { Todo, TodoType } from '../../contract/types';
import {
  resetStaleTodos,
  resetTodoForNewDay,
  resetTodosForNewDay,
} from '../reset';

const makeTodo = (
  id: string,
  type: TodoType,
  overrides: Partial<Todo> = {},
): Todo => ({
  id,
  text: id,
  completed: true,
  deleted: false,
  updatedAt: 100,
  type,
  progressNow: 2,
  progressEnd: 2,
  contribution: 1,
  days: '1111111',
  ...overrides,
});

const START = 1000;

describe('resetTodoForNewDay', () => {
  it('сбрасывает устаревшую daily', () => {
    const todo = makeTodo('1', 'daily');
    expect(resetTodoForNewDay(todo, START)).toMatchObject({
      progressNow: 0,
      completed: false,
      updatedAt: START,
    });
  });

  it('сбрасывает устаревшую привычку', () => {
    const todo = makeTodo('1', 'habit', { completed: false });
    expect(resetTodoForNewDay(todo, START)?.progressNow).toBe(0);
  });

  it('не сбрасывает свежие и не daily/habit', () => {
    expect(
      resetTodoForNewDay(makeTodo('1', 'daily', { updatedAt: START }), START),
    ).toBeNull();
    expect(resetTodoForNewDay(makeTodo('1', 'todo'), START)).toBeNull();
    expect(resetTodoForNewDay(makeTodo('1', 'tv_show'), START)).toBeNull();
    expect(
      resetTodoForNewDay(makeTodo('1', 'daily', { deleted: true }), START),
    ).toBeNull();
  });
});

describe('resetStaleTodos', () => {
  it('возвращает прежний массив, если сбрасывать нечего', () => {
    const todos = [makeTodo('1', 'daily', { updatedAt: START })];
    const result = resetStaleTodos(todos, START);

    expect(result.changed).toBe(false);
    expect(result.todos).toBe(todos);
    expect(result.resetTypes.size).toBe(0);
  });

  it('собирает типы сброшенных задач', () => {
    const todos = [makeTodo('1', 'daily'), makeTodo('2', 'habit')];
    const result = resetStaleTodos(todos, START);

    expect(result.changed).toBe(true);
    expect(Array.from(result.resetTypes).sort()).toEqual(['daily', 'habit']);
    expect(result.todos[0].progressNow).toBe(0);
    expect(result.todos[1].progressNow).toBe(0);
  });
});

describe('resetTodosForNewDay', () => {
  it('сбрасывает daily/habit безусловно, даже свежие', () => {
    const todos = [
      makeTodo('1', 'daily', { updatedAt: START }),
      makeTodo('2', 'todo', { updatedAt: START }),
    ];
    const result = resetTodosForNewDay(todos, 2000);

    expect(result.changed).toBe(true);
    expect(result.todos[0]).toMatchObject({
      progressNow: 0,
      completed: false,
      updatedAt: 2000,
    });
    expect(result.todos[1]).toBe(todos[1]);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
/**
 * Unit-тесты очереди исходящих операций: дедупликация, ack и reconnect.
 *
 * Хранилище подменяется in-memory массивом, чтобы тесты не зависели от
 * нативного MMKV/localStorage.
 */

import { ClientEvent } from '../../contract/events';
import type { Todo } from '../../contract/types';
import * as Outbox from '../outbox';

// vi.mock поднимается babel-jest выше импортов, поэтому модуль outbox
// сразу получает in-memory реализацию хранилища.
vi.mock('../../utils/storage', () => {
  let items: unknown[] = [];
  return {
    OutboxStorage: {
      getAll: () => items,
      saveAll: (next: unknown[]) => {
        items = next;
      },
      clear: () => {
        items = [];
      },
    },
  };
});

const makeTodo = (id: string, text = 'task'): Todo => ({
  id,
  text,
  completed: false,
  deleted: false,
  updatedAt: 1,
  type: 'todo',
  progressNow: 0,
  progressEnd: 1,
  contribution: 1,
  days: '1111111',
});

beforeEach(() => {
  Outbox.clear();
});

describe('enqueue', () => {
  it('заменяет неотправленную версию той же задачи', () => {
    Outbox.enqueue(ClientEvent.SYNC_TODO, makeTodo('1', 'old'));
    Outbox.enqueue(ClientEvent.SYNC_TODO, makeTodo('1', 'new'));

    const items = Outbox.getAll();
    expect(items).toHaveLength(1);
    expect((items[0].payload as Todo).text).toBe('new');
  });

  it('не трогает отправленную версию, ожидающую ack', () => {
    const first = Outbox.enqueue(ClientEvent.SYNC_TODO, makeTodo('1', 'old'));
    Outbox.markSent([first.requestId], 'batch-1');

    Outbox.enqueue(ClientEvent.SYNC_TODO, makeTodo('1', 'new'));

    const items = Outbox.getAll();
    expect(items).toHaveLength(2);
    const sent = items.find(item => item.sent);
    expect((sent?.payload as Todo).text).toBe('old');
  });

  it('дедуплицирует настройки и историю по ключу', () => {
    Outbox.enqueue(ClientEvent.UPDATE_SETTINGS, { theme: 'default' });
    Outbox.enqueue(ClientEvent.UPDATE_SETTINGS, { theme: 'dark' });
    Outbox.enqueue(ClientEvent.SYNC_DAILY_HISTORY, {
      date: '2026-11-13',
      mood: 3,
    });
    Outbox.enqueue(ClientEvent.SYNC_DAILY_HISTORY, {
      date: '2026-11-13',
      mood: 5,
    });

    const items = Outbox.getAll();
    expect(items).toHaveLength(2);
    expect(
      items.find(item => item.event === ClientEvent.UPDATE_SETTINGS)?.payload,
    ).toEqual({ theme: 'dark' });
    expect(
      items.find(item => item.event === ClientEvent.SYNC_DAILY_HISTORY)
        ?.payload,
    ).toEqual({ date: '2026-11-13', mood: 5 });
  });

  it('удаляет неотправленное создание при офлайн-удалении', () => {
    Outbox.enqueue(ClientEvent.SYNC_TODO, makeTodo('1'));
    Outbox.enqueue(ClientEvent.DELETE_TODO, '1');

    const items = Outbox.getAll();
    expect(items).toHaveLength(1);
    expect(items[0].event).toBe(ClientEvent.DELETE_TODO);
    expect(items[0].payload).toBe('1');
  });

  it('оставляет отправленное создание — его разрешит ack по LWW', () => {
    const created = Outbox.enqueue(ClientEvent.SYNC_TODO, makeTodo('1'));
    Outbox.markSent([created.requestId], 'batch-1');

    Outbox.enqueue(ClientEvent.DELETE_TODO, '1');

    expect(Outbox.getAll()).toHaveLength(2);
  });
});

describe('remove / removeBatch / markSent / resetSent', () => {
  it('удаляет запись по requestId', () => {
    const record = Outbox.enqueue(ClientEvent.DELETE_TODO, '1');
    Outbox.remove(record.requestId);
    expect(Outbox.getAll()).toHaveLength(0);
  });

  it('удаляет всю bulk-группу по batchId', () => {
    const first = Outbox.enqueue(ClientEvent.SYNC_TODO, makeTodo('1'));
    const second = Outbox.enqueue(ClientEvent.SYNC_TODO, makeTodo('2'));
    Outbox.markSent([first.requestId, second.requestId], 'batch-1');

    Outbox.removeBatch('batch-1');

    expect(Outbox.getAll()).toHaveLength(0);
  });

  it('resetSent возвращает отправленные операции в очередь', () => {
    const record = Outbox.enqueue(ClientEvent.SYNC_TODO, makeTodo('1'));
    Outbox.markSent([record.requestId], 'batch-1');

    Outbox.resetSent();

    const [item] = Outbox.getAll();
    expect(item.sent).toBe(false);
    expect(item.batchId).toBeUndefined();
    expect(item.requestId).toBe(record.requestId);
  });
});

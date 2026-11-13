/**
 * Единый клиент синхронизации.
 *
 * Все мутирующие socket-события проходят через `send`: в auth-режиме они
 * сразу уходят на сервер и ждут ack, в local-режиме/офлайне копятся в
 * outbox.  `flush` при reconnect/login собирает накопленное в bulk-запросы.
 */

import { socket } from '../utils/socket';
import { AuthStorage } from '../utils/storage';
import { emitWithRequestId, ClientPayloads } from '../contract/socket';
import { ClientEvent } from '../contract/events';
import type {
  AckPayload,
  DailyHistory,
  DeletedTodo,
  ServerErrorPayload,
  Todo,
  UserSettings,
} from '../contract/types';
import { newRequestId } from '../utils/protocol';
import * as Outbox from './outbox';
import type { SyncMode } from './types';

let mode: SyncMode = AuthStorage.getToken() ? 'auth' : 'local';

/** События, на которые сервер присылает `server:ack`. */
const ACK_EVENTS = new Set<string>([
  ClientEvent.SYNC_TODO,
  ClientEvent.DELETE_TODO,
  ClientEvent.UPDATE_SETTINGS,
  ClientEvent.SYNC_DAILY_HISTORY,
  ClientEvent.BULK_SYNC_TODOS,
  ClientEvent.BULK_DELETE_TODOS,
  ClientEvent.BULK_SYNC_DAILY_HISTORY,
]);

/**
 * Ошибки, после которых операцию имеет смысл повторить.  `conflict` сюда
 * не входит: конфликты разрешаются через ACK сервера, а не ретраем.
 */
const RETRYABLE_ERRORS = new Set<string>(['internal_error']);

export const setSyncMode = (next: SyncMode): void => {
  mode = next;
};

export const getSyncMode = (): SyncMode => mode;

const isOnline = (): boolean => mode === 'auth' && socket.connected;

/**
 * Отправляет операцию.  В auth-режиме при живом соединении — сразу,
 * иначе — в персистентный outbox.
 */
export const send = <E extends keyof ClientPayloads>(
  event: E,
  payload: ClientPayloads[E]
): void => {
  const expectsAck = ACK_EVENTS.has(event);
  const record = Outbox.enqueue(event, payload);

  if (!isOnline()) return;

  emitWithRequestId(event, payload, record.requestId);

  if (expectsAck) {
    Outbox.markSent([record.requestId], record.requestId);
  } else {
    // CONFIRM_RESET не подтверждается ack — запись больше не нужна.
    Outbox.remove(record.requestId);
  }
};

/**
 * Досылает накопленный outbox.  Однотипные операции объединяются в
 * bulk-запросы, чтобы после офлайна не устраивать шторм событий.
 */
export const flush = (): void => {
  if (!isOnline()) return;

  const items = Outbox.getAll().filter(item => !item.sent);
  if (items.length === 0) return;

  const todos = new Map<string, Todo>();
  const deletes: DeletedTodo[] = [];
  const history = new Map<string, DailyHistory>();
  let settings: UserSettings | null = null;
  const resets = new Map<string, { type: string; updatedAt: number }>();
  const others: typeof items = [];

  for (const item of items) {
    switch (item.event) {
      case ClientEvent.SYNC_TODO: {
        const todo = item.payload as Todo;
        todos.set(todo.id, todo);
        break;
      }
      case ClientEvent.DELETE_TODO:
        deletes.push({ id: item.payload as string });
        break;
      case ClientEvent.SYNC_DAILY_HISTORY: {
        const entry = item.payload as DailyHistory;
        history.set(entry.date, entry);
        break;
      }
      case ClientEvent.UPDATE_SETTINGS:
        settings = item.payload as UserSettings;
        break;
      case ClientEvent.CONFIRM_RESET: {
        const payload = item.payload as { type: string; updatedAt: number };
        resets.set(payload.type, payload);
        break;
      }
      default:
        others.push(item);
    }
  }

  const idsFor = (event: string): string[] =>
    items.filter(item => item.event === event).map(item => item.requestId);

  if (todos.size > 0) {
    const batchId = newRequestId();
    emitWithRequestId(ClientEvent.BULK_SYNC_TODOS, [...todos.values()], batchId);
    Outbox.markSent(idsFor(ClientEvent.SYNC_TODO), batchId);
  }

  if (deletes.length > 0) {
    const batchId = newRequestId();
    emitWithRequestId(ClientEvent.BULK_DELETE_TODOS, deletes, batchId);
    Outbox.markSent(idsFor(ClientEvent.DELETE_TODO), batchId);
  }

  if (history.size > 0) {
    const batchId = newRequestId();
    emitWithRequestId(
      ClientEvent.BULK_SYNC_DAILY_HISTORY,
      [...history.values()],
      batchId
    );
    Outbox.markSent(idsFor(ClientEvent.SYNC_DAILY_HISTORY), batchId);
  }

  if (settings) {
    const batchId = newRequestId();
    emitWithRequestId(ClientEvent.UPDATE_SETTINGS, settings, batchId);
    Outbox.markSent(idsFor(ClientEvent.UPDATE_SETTINGS), batchId);
  }

  if (resets.size > 0) {
    resets.forEach(payload => {
      emitWithRequestId(ClientEvent.CONFIRM_RESET, payload, newRequestId());
    });
    idsFor(ClientEvent.CONFIRM_RESET).forEach(id => Outbox.remove(id));
  }

  others.forEach(item => {
    emitWithRequestId(
      item.event as keyof ClientPayloads,
      item.payload as never,
      item.requestId
    );
    Outbox.markSent([item.requestId], item.requestId);
  });
};

/** Ack подтверждает операцию (или весь bulk-запрос) — убираем из outbox. */
export const handleAck = (ack: AckPayload): void => {
  if (!ack.request_id) return;
  if (ack.status === 'rejected') {
    console.warn('[Sync] Payload rejected by server:', ack);
  }
  Outbox.removeBatch(ack.request_id);
};

/**
 * Ошибка сервера: retryable-операции возвращаем в очередь, остальные
 * удаляем, чтобы они не зациклились.
 */
export const handleError = (error: ServerErrorPayload): void => {
  if (!error.request_id) return;

  const items = Outbox.getAll();
  const affected = items.filter(
    item =>
      item.requestId === error.request_id || item.batchId === error.request_id
  );
  if (affected.length === 0) return;

  const affectedIds = new Set(affected.map(item => item.requestId));

  if (RETRYABLE_ERRORS.has(error.code)) {
    Outbox.saveAll(
      items.map(item =>
        affectedIds.has(item.requestId)
          ? {
              ...item,
              sent: false,
              batchId: undefined,
              attempts: item.attempts + 1,
            }
          : item
      )
    );
  } else {
    Outbox.saveAll(items.filter(item => !affectedIds.has(item.requestId)));
  }
};

/** Reconnect: переотправляем всё, что не получило ack. */
export const onReconnect = (): void => {
  Outbox.resetSent();
  flush();
};

/** Полный выход из аккаунта: очередь прошлого пользователя не переносим. */
export const clear = (): void => Outbox.clear();

export const getPendingCount = (): number => Outbox.getAll().length;

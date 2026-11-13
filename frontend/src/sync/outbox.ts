/**
 * Персистентная очередь исходящих операций.
 *
 * Каждая операция получает `requestId`, который уходит на сервер в конверте
 * `{request_id, payload}`.  Запись живёт в outbox до `server:ack`; при
 * ошибке она либо остаётся для retry, либо удаляется как неисправимая.
 */

import { OutboxStorage, OutboxRecord } from '../utils/storage';
import { newRequestId } from '../utils/protocol';
import { ClientEvent, ClientEventName } from '../contract/events';
import type { DailyHistory, Todo } from '../contract/types';

/**
 * Ключ дедупликации: повторные изменения одной сущности не должны
 * раздувать очередь, пока предыдущая версия ещё не отправлена.
 */
const keyOf = (event: string, payload: unknown): string | null => {
  switch (event) {
    case ClientEvent.SYNC_TODO:
      return `todo:${(payload as Todo)?.id}`;
    case ClientEvent.DELETE_TODO:
      return `delete:${payload as string}`;
    case ClientEvent.SYNC_DAILY_HISTORY:
      return `history:${(payload as DailyHistory)?.date}`;
    case ClientEvent.UPDATE_SETTINGS:
      return 'settings';
    case ClientEvent.CONFIRM_RESET:
      return `reset:${(payload as { type?: string })?.type}`;
    default:
      return null;
  }
};

export const getAll = (): OutboxRecord[] => OutboxStorage.getAll();

export const saveAll = (items: OutboxRecord[]): void => OutboxStorage.saveAll(items);

export const enqueue = (
  event: ClientEventName,
  payload: unknown
): OutboxRecord => {
  const key = keyOf(event, payload);
  const existing = OutboxStorage.getAll();
  // Уже отправленные записи не трогаем: их ждёт ack.  Неотправленную
  // версию той же сущности заменяем актуальной.
  const filtered = existing.filter(item => {
    // Удаление вычищает все версии создания, включая уже отправленные:
    // иначе reconnect переотправит SYNC_TODO и воскресит задачу.
    if (event === ClientEvent.DELETE_TODO) {
      const id = payload as string;
      if (
        item.event === ClientEvent.SYNC_TODO &&
        (item.payload as Todo)?.id === id
      ) {
        return false;
      }
    }

    if (item.sent) return true;
    if (key && keyOf(item.event, item.payload) === key) return false;

    return true;
  });

  const record: OutboxRecord = {
    requestId: newRequestId(),
    event,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    sent: false,
  };

  OutboxStorage.saveAll([...filtered, record]);
  return record;
};

export const remove = (requestId: string): void => {
  OutboxStorage.saveAll(
    OutboxStorage.getAll().filter(item => item.requestId !== requestId)
  );
};

/** Удаляет запись и все операции, отправленные тем же bulk-запросом. */
export const removeBatch = (batchId: string): void => {
  OutboxStorage.saveAll(
    OutboxStorage.getAll().filter(
      item => item.requestId !== batchId && item.batchId !== batchId
    )
  );
};

export const markSent = (requestIds: string[], batchId: string): void => {
  const ids = new Set(requestIds);
  OutboxStorage.saveAll(
    OutboxStorage.getAll().map(item =>
      ids.has(item.requestId) ? { ...item, sent: true, batchId } : item
    )
  );
};

/** После reconnect отправленные, но не подтверждённые операции шлём заново. */
export const resetSent = (): void => {
  OutboxStorage.saveAll(
    OutboxStorage.getAll().map(item => ({
      ...item,
      sent: false,
      batchId: undefined,
    }))
  );
};

export const clear = (): void => OutboxStorage.clear();

/**
 * Протокол синхронизации: конверт запроса и типы ответов сервера.
 *
 * `request_id` возвращается в `server:ack` / `server:error`, чтобы
 * сопоставить ответ с отправленным изменением.  Типы живут в
 * `src/contract/types.ts` и синхронизированы с бэкендом.
 */

import type { RequestEnvelope } from '../contract/types';

export type {
  AckPayload,
  AckStatus,
  RequestEnvelope,
  ServerErrorPayload,
} from '../contract/types';

export const newRequestId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const request = <T>(payload: T): RequestEnvelope<T> => ({
  request_id: newRequestId(),
  payload,
});

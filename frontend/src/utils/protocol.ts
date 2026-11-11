/**
 * Протокол синхронизации: конверт запроса и типы ответов сервера.
 *
 * `request_id` возвращается в `server:ack` / `server:error`, чтобы
 * сопоставить ответ с отправленным изменением.
 */

export type AckStatus =
  | 'applied'
  | 'conflict'
  | 'deleted'
  | 'rejected'
  | 'processed';

export interface RequestEnvelope<T> {
  request_id: string;
  payload: T;
}

export interface AckPayload<T = any> {
  request_id: string | null;
  event: string;
  status: AckStatus;
  data: T | null;
}

export interface ServerErrorPayload {
  code: string;
  message: string;
  request_id: string | null;
  event: string | null;
}

export const newRequestId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const request = <T>(payload: T): RequestEnvelope<T> => ({
  request_id: newRequestId(),
  payload,
});

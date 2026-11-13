/**
 * Типизированные обёртки над socket.io.
 *
 * Компоненты не должны знать строковые имена событий: `emit`/`on` берут
 * их из `events.ts`, а payload проверяется по контракту из `types.ts`.
 */

import { socket } from '../utils/socket';
import { newRequestId } from '../utils/protocol';
import { ClientEvent, ServerEvent } from './events';
import {
  AckPayload,
  DailyHistory,
  DeletedTodo,
  ServerErrorPayload,
  StatePayload,
  Todo,
  UserSettings,
} from './types';

export interface ClientPayloads {
  [ClientEvent.REGISTER]: { username: string; password: string };
  [ClientEvent.LOGIN]: { username: string; password: string };
  [ClientEvent.LOGOUT]: undefined;
  [ClientEvent.GET_STATE]: string | undefined;
  [ClientEvent.GET_TODOS]: undefined;
  [ClientEvent.SYNC_TODO]: Todo;
  [ClientEvent.DELETE_TODO]: string;
  [ClientEvent.CONFIRM_RESET]: { type: string; updatedAt: number };
  [ClientEvent.BULK_SYNC_TODOS]: Todo[];
  [ClientEvent.BULK_DELETE_TODOS]: DeletedTodo[];
  [ClientEvent.GET_MONTH_HISTORY]: string;
  [ClientEvent.SYNC_DAILY_HISTORY]: DailyHistory;
  [ClientEvent.BULK_SYNC_DAILY_HISTORY]: DailyHistory[];
  [ClientEvent.UPDATE_SETTINGS]: UserSettings;
}

export interface ServerPayloads {
  [ServerEvent.AUTH_MESSAGE]: {
    status: 'success' | 'error' | 'info';
    message: string;
  };
  [ServerEvent.AUTH_EXPIRED]: undefined;
  [ServerEvent.REGISTER_SUCCESS]: undefined;
  [ServerEvent.LOGIN_SUCCESS]: {
    username: string;
    token: string;
    settings: UserSettings;
  };
  [ServerEvent.STATE]: StatePayload;
  [ServerEvent.ALL_TODOS]: Todo[];
  [ServerEvent.TODO_UPDATED]: Todo;
  [ServerEvent.TODO_DELETED]: string;
  [ServerEvent.MONTH_HISTORY]: { month: string; history: DailyHistory[] };
  [ServerEvent.DAILY_HISTORY_UPDATED]: DailyHistory;
  [ServerEvent.SETTINGS_UPDATED]: UserSettings;
  [ServerEvent.ACK]: AckPayload;
  [ServerEvent.ERROR]: ServerErrorPayload;
}

/** Отправляет мутирующее событие с заданным `request_id`. */
export const emitWithRequestId = <E extends keyof ClientPayloads>(
  event: E,
  payload: ClientPayloads[E],
  requestId: string
): void => {
  socket.emit(event, { request_id: requestId, payload });
};

/**
 * Отправляет мутирующее событие в конверте `{request_id, payload}` и
 * возвращает `request_id`, чтобы вызывающий мог сопоставить ack/error.
 */
export const emit = <E extends keyof ClientPayloads>(
  event: E,
  payload: ClientPayloads[E]
): string => {
  const requestId = newRequestId();
  emitWithRequestId(event, payload, requestId);
  return requestId;
};

/** Отправляет событие без конверта (login/register/logout). */
export const emitRaw = <E extends keyof ClientPayloads>(
  event: E,
  payload: ClientPayloads[E]
): void => {
  socket.emit(event, payload);
};

/** Подписывается на серверное событие и возвращает функцию отписки. */
export const on = <E extends keyof ServerPayloads>(
  event: E,
  handler: (payload: ServerPayloads[E]) => void
): (() => void) => {
  const listener = handler as (...args: unknown[]) => void;
  (socket as any).on(event, listener);
  return () => {
    (socket as any).off(event, listener);
  };
};

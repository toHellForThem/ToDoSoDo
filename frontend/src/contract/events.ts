/**
 * Имена socket-событий и статусы ack.
 *
 * Синхронизировано с `backend/contracts/events.json`; проверяется
 * `npm run contract:check`.
 */

export const ClientEvent = {
  REGISTER: 'client:register',
  LOGIN: 'client:login',
  LOGOUT: 'client:logout',

  GET_STATE: 'client:get_state',
  GET_TODOS: 'client:get_todos',
  SYNC_TODO: 'client:sync_todo',
  DELETE_TODO: 'client:delete_todo',
  CONFIRM_RESET: 'client:confirm_reset',
  BULK_SYNC_TODOS: 'client:bulk_sync_todos',
  BULK_DELETE_TODOS: 'client:bulk_delete_todos',

  GET_MONTH_HISTORY: 'client:get_month_history',
  SYNC_DAILY_HISTORY: 'client:sync_daily_history',
  BULK_SYNC_DAILY_HISTORY: 'client:bulk_sync_daily_history',

  UPDATE_SETTINGS: 'client:update_settings',
} as const;

export type ClientEventName = (typeof ClientEvent)[keyof typeof ClientEvent];

export const ServerEvent = {
  AUTH_MESSAGE: 'server:auth_message',
  AUTH_EXPIRED: 'server:auth_expired',
  REGISTER_SUCCESS: 'server:register_success',
  LOGIN_SUCCESS: 'server:login_success',

  STATE: 'server:state',
  ALL_TODOS: 'server:all_todos',
  TODO_UPDATED: 'server:todo_updated',
  TODO_DELETED: 'server:todo_deleted',

  MONTH_HISTORY: 'server:month_history',
  DAILY_HISTORY_UPDATED: 'server:daily_history_updated',

  SETTINGS_UPDATED: 'server:settings_updated',

  ACK: 'server:ack',
  ERROR: 'server:error',
} as const;

export type ServerEventName = (typeof ServerEvent)[keyof typeof ServerEvent];

export const ACK_STATUSES = [
  'applied',
  'conflict',
  'deleted',
  'rejected',
  'processed',
] as const;

/**
 * Типы контракта синхронизации.
 *
 * Источник истины — `backend/contracts/*.schema.json` и
 * `backend/app/events/names.py`.  При изменении схемы на бэкенде эти типы
 * должны обновляться вместе с ней; `npm run contract:check` сверяет имена
 * событий и поля с экспортированным контрактом.
 */

export type TodoType =
  'todo' | 'daily' | 'habit' | 'piggy_bank' | 'tv_show' | 'movie';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  deleted: boolean;
  updatedAt: number;
  type: TodoType;
  progressNow: number | string;
  progressEnd: number | string;
  contribution: number;
  days: string;
}

export interface ShortcutSettings {
  rpg_tab: string;
  todo_tab: string;
  daily_tab: string;
  habits_subtab: string;
  piggy_subtab: string;
  tv_subtab: string;
  recycle_view: string;
  settings_view: string;
  calendar_view: string;
  mood_view: string;
}

export type MainPage = 'todo' | 'rpg' | 'daily';
export type ThemeName = 'default' | 'dark' | 'mint' | 'pink';
export type RpgSubtab = 'dashboard' | 'habits' | 'piggy_bank' | 'tv_shows';
export type Language = 'ru' | 'en';

export interface UserSettings {
  main_page: MainPage;
  theme: ThemeName;
  soft_delete: boolean;
  reset_time: string;
  /** IANA-пояс пользователя: общий для всех устройств аккаунта. */
  timezone: string;
  rpg_subtab: RpgSubtab;
  reset_enabled: boolean;
  language: Language;
  shortcuts: ShortcutSettings;
  updatedAt: number;
}

export interface DailyHistory {
  date: string;
  mood: number | null;
  daily_progress: number;
  pos_points: number;
  neg_points: number;
  habits_detail: string;
  updatedAt: number;
}

/** Обратная совместимость: история в UI называется RpgHistoryItem. */
export type RpgHistoryItem = DailyHistory;

/** Режим авторизации: локальный, авторизованный или промежуточный (пустой). */
export type AuthMode = 'local' | 'auth' | '';

export type AckStatus =
  'applied' | 'conflict' | 'deleted' | 'rejected' | 'processed';

export type ErrorCode =
  | 'validation_error'
  | 'auth_error'
  | 'not_found'
  | 'conflict'
  | 'unauthorized'
  | 'internal_error';

export interface RequestEnvelope<T> {
  request_id: string;
  payload: T;
}

export interface AckPayload<T = unknown> {
  request_id: string | null;
  event: string;
  status: AckStatus;
  data: T | null;
}

export interface ServerErrorPayload {
  code: ErrorCode;
  message: string;
  request_id: string | null;
  event: string | null;
}

/** Tombstone, который клиент досылает после офлайн-удаления. */
export interface DeletedTodo {
  id: string;
  deletedAt?: number;
}

export interface BulkResult<T> {
  id: string;
  status: AckStatus;
  todo?: T;
}

export interface StatePayload {
  request_id: string | null;
  todos: Todo[];
  settings: UserSettings;
  history: {
    month: string;
    entries: DailyHistory[];
  };
}

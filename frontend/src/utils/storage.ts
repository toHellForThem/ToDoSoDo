import { Platform, NativeModules } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import type {
  AuthMode,
  Language,
  MainPage,
  RpgHistoryItem,
  RpgSubtab,
  ShortcutSettings,
  ThemeName,
  Todo,
  TodoType,
  UserSettings,
} from '../contract/types';

export type {
  AuthMode,
  Language,
  MainPage,
  RpgHistoryItem,
  RpgSubtab,
  ShortcutSettings,
  ThemeName,
  Todo,
  TodoType,
  UserSettings,
} from '../contract/types';

/** Локальная метка жёсткого удаления, которую нужно дослать на сервер. */
export interface TodoTombstone {
  id: string;
  updatedAt: number;
}

export const DEFAULT_SHORTCUTS: ShortcutSettings = {
  rpg_tab: 'mod+1',
  todo_tab: 'mod+2',
  daily_tab: 'mod+3',
  habits_subtab: 'mod+q',
  piggy_subtab: 'mod+w',
  tv_subtab: 'mod+e',
  recycle_view: 'mod+r',
  settings_view: 'mod+s',
  calendar_view: 'mod+c',
  mood_view: 'mod+x',
}

const nativeStorage = Platform.OS !== 'web' ? createMMKV() : null;

const getSystemLanguage = () => {
  try {
    let locale = '';
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      locale = settings?.AppleLocale || settings?.AppleLanguages?.[0] || '';
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || '';
    } else {
      if (typeof navigator !== 'undefined') {
        locale = navigator.language || '';
      }
    }
    if (locale && locale.toLowerCase().startsWith('ru')) {
      return 'ru';
    }
    return 'en';
  } catch (error) {
    return 'ru';
  }
};

const getSystemTimezone = (): string => {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }
  } catch (error) {
    // Hermes без ICU — используем UTC, пользователь сможет поменять пояс.
  }
  return 'UTC';
};

export const getDefaultSettings = (): UserSettings => {
  const settings: UserSettings = {
    main_page: 'todo',
    theme: 'default',
    soft_delete: true,
    reset_time: '00:00',
    timezone: getSystemTimezone(),
    rpg_subtab: 'dashboard',
    reset_enabled: true,
    language: getSystemLanguage(),
    shortcuts: DEFAULT_SHORTCUTS,
    updatedAt: 0
  }
  return settings
}

const core = {
  set: (key: string, value: string): void => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      nativeStorage!.set(key, value);
    }
  },
  get: (key: string): string | null => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return nativeStorage ? nativeStorage.getString(key) ?? null : null;
    }
  },
  remove: (key: string): void => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      nativeStorage!.remove(key);
    }
  }
};

export { nativeStorage };

export const TodoStorage = {
  saveAll: (todos: Todo[]): void => core.set('todo_list', JSON.stringify(todos)),
  getAll: (): Todo[] => {
    const data = core.get('todo_list');
    return data ? JSON.parse(data) : [];
  }
};

export const RpgStorage = {
  saveHistory: (history: RpgHistoryItem[]): void => core.set('rpg_history', JSON.stringify(history)),
  getHistory: (): RpgHistoryItem[] => {
    const data = core.get('rpg_history');
    return data ? JSON.parse(data) : [];
  }
};

/**
 * Запись очереди синхронизации: операция, ожидающая подтверждения сервера.
 * `sent` — операция уже отправлена, но ack ещё не получен; `batchId` —
 * идентификатор bulk-запроса, которым была отправлена группа операций.
 */
export interface OutboxRecord {
  requestId: string;
  event: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  sent: boolean;
  batchId?: string;
}

/**
 * Outbox переживает перезапуск приложения: операции, сделанные офлайн или
 * в local-режиме, досылаются на сервер после reconnect/логина.
 */
export const OutboxStorage = {
  getAll: (): OutboxRecord[] => {
    const data = core.get('sync_outbox');
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  },
  saveAll: (items: OutboxRecord[]): void => {
    try {
      core.set('sync_outbox', JSON.stringify(items));
    } catch (error) {
      console.warn('Failed to persist sync outbox:', error);
    }
  },
  clear: (): void => core.remove('sync_outbox'),
};

/**
 * Tombstones жёстких удалений.  Хранятся отдельно от списка задач, чтобы
 * удаление не терялось, пока сервер недоступен, и досылалось при reconnect.
 */
export const TombstoneStorage = {
  getAll: (): TodoTombstone[] => {
    const data = core.get('todo_tombstones');
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  },
  add: (id: string): void => {
    try {
      const tombstones = TombstoneStorage.getAll().filter(item => item.id !== id);
      tombstones.push({ id, updatedAt: Date.now() });
      core.set('todo_tombstones', JSON.stringify(tombstones));
    } catch (error) {
      // Переполнение localStorage/приватный режим не должны ломать удаление.
      console.warn('Failed to persist todo tombstone:', error);
    }
  },
  remove: (id: string): void => {
    try {
      const tombstones = TombstoneStorage.getAll().filter(item => item.id !== id);
      core.set('todo_tombstones', JSON.stringify(tombstones));
    } catch (error) {
      console.warn('Failed to remove todo tombstone:', error);
    }
  },
  clear: (): void => {
    core.remove('todo_tombstones');
  }
};

export const AuthStorage = {
  setUsername: (username: string): void => core.set('username', username),
  getUsername: (): string | null => core.get('username'),

  setToken: (token: string): void => core.set('user_token', token),
  getToken: (): string | null => core.get('user_token'),

  setSettings: (settings: UserSettings): void => core.set('user_settings', JSON.stringify(settings)),
  getSettings: (): UserSettings => {
    const data = core.get('user_settings');
    const defaultShortcuts: ShortcutSettings = DEFAULT_SHORTCUTS;
    const defaultSettings = getDefaultSettings();
    if (data) {
      const parsed = JSON.parse(data);
      return {
        ...defaultSettings,
        ...parsed,
        shortcuts: {
          ...defaultShortcuts,
          ...(parsed.shortcuts || {})
        }
      };
    }
    return defaultSettings;
  },

  setServerUrl: (url: string): void => core.set('server_url', url),
  getServerUrl: (): string | null => core.get('server_url'),

  /** Сбрасывает только сессию, сохраняя локальные данные и настройки. */
  clearSession: (): void => {
    core.remove('username');
    core.remove('user_token');
    core.remove('server_url');
  },

  logout: (): void => {
    core.remove('username');
    core.remove('user_token');
    core.remove('user_settings');
    core.remove('server_url');
    // Явный выход: tombstones прошлого пользователя не должны уйти под новым.
    TombstoneStorage.clear();
  }
};
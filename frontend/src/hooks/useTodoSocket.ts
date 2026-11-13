import { useEffect, startTransition, Dispatch, SetStateAction } from 'react';
import Toast from 'react-native-toast-message';
import { socket } from '../utils/socket';
import { emit, on } from '../contract/socket';
import { ClientEvent, ServerEvent } from '../contract/events';
import type { AckPayload, ServerErrorPayload } from '../contract/types';
import {
  AuthStorage,
  RpgStorage,
  TodoStorage,
  TombstoneStorage,
  UserSettings,
  Todo,
  RpgHistoryItem,
  AuthMode
} from '../utils/storage';
import { getLogicalDayStartMs } from '../utils/date';


interface UseTodoSocketProps {
  setTodoList: Dispatch<SetStateAction<Todo[]>>;
  setAuthMode: (mode: AuthMode) => void;
  setAuthState: (state: string) => void;
  setRpgHistory: Dispatch<SetStateAction<RpgHistoryItem[]>>;
  setSettings: (settings: UserSettings) => void;
  settings: UserSettings;
  setMainTab?: (tab: string) => void;
  onSessionCleared?: () => void;
}

export const useTodoSocket = ({
  setTodoList,
  setAuthMode,
  setAuthState,
  setRpgHistory,
  setSettings,
  settings,
  setMainTab,
  onSessionCleared
}: UseTodoSocketProps) => {
  useEffect(() => {
    let shouldReplaceTodos = false;
    let shouldReplaceHistory = false;
    const unsubscribers: Array<() => void> = [];

    socket.on('connect', () => {
      console.log('Connected to Server!');
    });

    unsubscribers.push(on(ServerEvent.LOGIN_SUCCESS, (data) => {
      const { username, token, settings: serverSettings } = data;

      socket.auth = { username, token };

      shouldReplaceTodos = true;
      shouldReplaceHistory = true;

      const localTodos = TodoStorage.getAll();
      const localHistory = RpgStorage.getHistory();

      // Сначала досылаем жёсткие удаления, накопленные офлайн.
      TombstoneStorage.getAll().forEach(tombstone => {
        emit(ClientEvent.DELETE_TODO, tombstone.id);
      });

      emit(ClientEvent.BULK_SYNC_TODOS, localTodos);
      emit(ClientEvent.BULK_SYNC_DAILY_HISTORY, localHistory);

      setAuthMode('auth');
      setAuthState('');
      AuthStorage.setUsername(username);
      AuthStorage.setToken(token);

      const localSettings = AuthStorage.getSettings();
      const localUpdatedAt = localSettings.updatedAt || 0;
      const serverUpdatedAt = serverSettings.updatedAt || 0;

      let finalSettings;
      if (localUpdatedAt > serverUpdatedAt) {
        finalSettings = localSettings;
        emit(ClientEvent.UPDATE_SETTINGS, finalSettings);
      } else {
        finalSettings = { ...localSettings, ...serverSettings };
        // Если на сервере настройки ещё не кастомизировали (updatedAt = 0),
        // забираем пояс устройства, чтобы новые аккаунты не жили в UTC.
        if (
          serverUpdatedAt === 0 &&
          localSettings.timezone &&
          localSettings.timezone !== finalSettings.timezone
        ) {
          finalSettings = {
            ...finalSettings,
            timezone: localSettings.timezone,
            updatedAt: Date.now()
          };
          emit(ClientEvent.UPDATE_SETTINGS, finalSettings);
        }
      }

      AuthStorage.setSettings(finalSettings);
      setSettings(finalSettings);
      if (setMainTab && finalSettings?.main_page) {
        setMainTab(finalSettings.main_page);
      }
    }));

    unsubscribers.push(on(ServerEvent.ALL_TODOS, (serverTodos) => {
      const startOfToday = getLogicalDayStartMs(
        settings?.reset_time,
        settings?.timezone
      );
      const resetTypes = new Set<string>();

      // Tombstones: если сервер всё ещё знает задачу — повторяем удаление,
      // если уже нет — метку можно снять.
      const tombstones = TombstoneStorage.getAll();
      const tombstoneIds = new Set(tombstones.map(item => item.id));
      const serverIds = new Set(serverTodos.map(item => item.id));
      tombstones.forEach(tombstone => {
        if (serverIds.has(tombstone.id)) {
          emit(ClientEvent.DELETE_TODO, tombstone.id);
        } else {
          TombstoneStorage.remove(tombstone.id);
        }
      });

      if (shouldReplaceTodos) {
        shouldReplaceTodos = false;

        const processedTodos = serverTodos
          .filter(sItem => !tombstoneIds.has(sItem.id))
          .map(sItem => {
            let processedItem = { ...sItem };
            if (
              settings?.reset_enabled !== false &&
              !processedItem.deleted &&
              (processedItem.type === 'daily' || processedItem.type === 'habit') &&
              processedItem.updatedAt < startOfToday
            ) {
              processedItem.progressNow = 0;
              processedItem.completed = false;
              processedItem.updatedAt = startOfToday;
              resetTypes.add(processedItem.type);
            }
            return processedItem;
          });

        startTransition(() => {
          setTodoList(processedTodos);
        });

        if (resetTypes.size > 0) {
          resetTypes.forEach(type => {
            emit(ClientEvent.CONFIRM_RESET, { type, updatedAt: startOfToday });
          });
        }
        return;
      }

      startTransition(() => {
        setTodoList(localTodos => {
          const merged = [...localTodos];
          let hasChanges = false;

          serverTodos.forEach(sItem => {
            if (tombstoneIds.has(sItem.id)) return;

            let processedItem = { ...sItem };

            if (
              settings?.reset_enabled !== false &&
              !processedItem.deleted &&
              (processedItem.type === 'daily' || processedItem.type === 'habit') &&
              processedItem.updatedAt < startOfToday
            ) {
              processedItem.progressNow = 0;
              processedItem.completed = false;
              processedItem.updatedAt = startOfToday;
              resetTypes.add(processedItem.type);
              hasChanges = true;
            }

            const localIndex = merged.findIndex(l => l.id === processedItem.id);
            if (localIndex === -1) {
              merged.push(processedItem);
              hasChanges = true;
            } else {
              const lItem = merged[localIndex];
              if (processedItem.updatedAt > (lItem.updatedAt || 0)) {
                merged[localIndex] = processedItem;
                hasChanges = true;
              } else if ((lItem.updatedAt || 0) > processedItem.updatedAt) {
                emit(ClientEvent.SYNC_TODO, lItem);
              }
            }
          });
          return hasChanges ? merged : localTodos;
        });
      });

      if (resetTypes.size > 0) {
        resetTypes.forEach(type => {
          emit(ClientEvent.CONFIRM_RESET, { type, updatedAt: startOfToday });
        });
      }
    }));

    unsubscribers.push(on(ServerEvent.TODO_UPDATED, (updatedTodo) => {
      startTransition(() => {
        setTodoList(prev => {
          const index = prev.findIndex(t => t.id === updatedTodo.id);
          if (index !== -1) {
            const existing = prev[index];
            if (updatedTodo.updatedAt > (existing.updatedAt || 0)) {
              const newList = [...prev];
              newList[index] = updatedTodo;
              return newList;
            }
            return prev;
          }
          return [...prev, updatedTodo];
        });
      });
    }));

    unsubscribers.push(on(ServerEvent.TODO_DELETED, (deletedId) => {
      TombstoneStorage.remove(deletedId);
      startTransition(() => {
        setTodoList(prev => prev.filter(todo => todo.id !== deletedId));
      });
    }));

    unsubscribers.push(on(ServerEvent.REGISTER_SUCCESS, () => {
      startTransition(() => {
        setAuthMode('');
        setAuthState('login');
      });
    }));

    unsubscribers.push(on(ServerEvent.AUTH_EXPIRED, () => {
      startTransition(() => {
        // Истёкшая сессия не должна стирать локальные задачи и историю:
        // пользователь продолжает работать в local-режиме.
        AuthStorage.clearSession();
        onSessionCleared?.();
        socket.auth = {};
        setAuthMode('local');
        setAuthState('login');
        Toast.show({
          type: 'error',
          text1: 'Сессия истекла',
          text2: 'Пожалуйста, авторизуйтесь заново',
          visibilityTime: 4000
        });
      });
    }));

    unsubscribers.push(on(ServerEvent.MONTH_HISTORY, (data) => {
      startTransition(() => {
        if (data && data.history) {
          shouldReplaceHistory = false;

          setRpgHistory(prev => {
            const merged = [...prev];
            data.history.forEach(srvLog => {
              const localIdx = merged.findIndex(h => h.date === srvLog.date);
              if (localIdx === -1) {
                merged.push(srvLog);
              } else {
                merged[localIdx] = srvLog;
              }
            });
            return merged;
          });
        }
      });
    }));

    unsubscribers.push(on(ServerEvent.DAILY_HISTORY_UPDATED, (data) => {
      startTransition(() => {
        setRpgHistory(prev => {
          const index = prev.findIndex(h => h.date === data.date);
          if (index !== -1) {
            const newList = [...prev];
            newList[index] = data;
            return newList;
          }
          return [...prev, data];
        });
      });
    }));

    unsubscribers.push(on(ServerEvent.SETTINGS_UPDATED, (serverSettings) => {
      startTransition(() => {
        AuthStorage.setSettings(serverSettings);
        setSettings(serverSettings);
        if (setMainTab && serverSettings?.main_page) {
          setMainTab(serverSettings.main_page);
        }
      });
    }));

    unsubscribers.push(on(ServerEvent.ACK, (ack: AckPayload) => {
      const { event, status, data } = ack;

      if (status === 'conflict') {
        Toast.show({
          type: 'info',
          text1: 'Синхронизация',
          text2: 'Изменение не применено: на сервере более новая версия',
          visibilityTime: 3000
        });
      }

      if (event === 'client:sync_todo') {
        if (status === 'conflict' && data) {
          const serverTodo = data as Todo;
          startTransition(() => {
            setTodoList(prev => {
              const index = prev.findIndex(t => t.id === serverTodo.id);
              if (index === -1) {
                return [...prev, serverTodo];
              }
              const next = [...prev];
              next[index] = serverTodo;
              return next;
            });
          });
        } else if (status === 'deleted') {
          const deletedId = (data as { id?: string } | null)?.id;
          if (deletedId) {
            startTransition(() => {
              setTodoList(prev => prev.filter(t => t.id !== deletedId));
            });
          }
        }
      } else if (event === 'client:update_settings' && status === 'conflict' && data) {
        const serverSettings = data as UserSettings;
        AuthStorage.setSettings(serverSettings);
        setSettings(serverSettings);
        if (setMainTab && serverSettings?.main_page) {
          setMainTab(serverSettings.main_page);
        }
      } else if (
        event === 'client:sync_daily_history' &&
        status === 'conflict' &&
        data
      ) {
        const serverEntry = data as RpgHistoryItem;
        startTransition(() => {
          setRpgHistory(prev => {
            const index = prev.findIndex(h => h.date === serverEntry.date);
            if (index === -1) {
              return [...prev, serverEntry];
            }
            const next = [...prev];
            next[index] = serverEntry;
            return next;
          });
        });
      }
    }));

    unsubscribers.push(on(ServerEvent.ERROR, (error: ServerErrorPayload) => {
      if (error.code === 'unauthorized') {
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Синхронизация',
        text2: error.message,
        visibilityTime: 4000
      });
    }));

    return () => {
      socket.off('connect');
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [setTodoList, setAuthMode, setAuthState, setRpgHistory, setSettings, settings, setMainTab]);
};

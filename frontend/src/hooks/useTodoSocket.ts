import { useEffect, startTransition } from 'react';
import Toast from 'react-native-toast-message';
import { socket } from '../utils/socket';
import { on } from '../contract/socket';
import { ClientEvent, ServerEvent } from '../contract/events';
import {
  send,
  flush,
  handleAck,
  handleError,
  onReconnect,
  setSyncMode,
  setSyncErrorListener,
} from '../sync';
import type {
  AckPayload,
  AckStatus,
  BulkResult,
  ServerErrorPayload
} from '../contract/types';
import {
  AuthStorage,
  RpgStorage,
  TodoStorage,
  TombstoneStorage,
  UserSettings,
  Todo,
  RpgHistoryItem,
} from '../utils/storage';
import { getLogicalDayStartMs } from '../utils/date';
import { resetStaleTodos, resetTodoForNewDay } from '../domain/reset';
import { normalizeMainTab, useAppStore } from '../store/appStore';

interface UseTodoSocketOptions {
  onSessionCleared?: () => void;
}

export const useTodoSocket = ({ onSessionCleared }: UseTodoSocketOptions = {}) => {
  useEffect(() => {
    setSyncErrorListener(message => {
      Toast.show({
        type: 'error',
        text1: 'Синхронизация',
        text2: message,
        visibilityTime: 4000,
      });
    });
    return () => setSyncErrorListener(null);
  }, []);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    let shouldReplaceTodos = false;

    socket.on('connect', () => {
      onReconnect();
    });

    unsubscribers.push(on(ServerEvent.LOGIN_SUCCESS, (data) => {
      const { username, token, settings: serverSettings } = data;
      const store = useAppStore.getState();

      socket.auth = { username, token };

      shouldReplaceTodos = true;

      const localTodos = TodoStorage.getAll();
      const localHistory = RpgStorage.getHistory();

      store.setAuthMode('auth');
      store.setAuthState('');
      store.setHistoryLoaded(false);
      AuthStorage.setUsername(username);
      AuthStorage.setToken(token);
      setSyncMode('auth');

      // Сначала досылаем жёсткие удаления, накопленные офлайн.
      TombstoneStorage.getAll().forEach(tombstone => {
        send(ClientEvent.DELETE_TODO, tombstone.id);
      });

      send(ClientEvent.BULK_SYNC_TODOS, localTodos);
      send(ClientEvent.BULK_SYNC_DAILY_HISTORY, localHistory);
      flush();

      const localSettings = AuthStorage.getSettings();
      const localUpdatedAt = localSettings.updatedAt || 0;
      const serverUpdatedAt = serverSettings.updatedAt || 0;

      let finalSettings;
      if (localUpdatedAt > serverUpdatedAt) {
        finalSettings = localSettings;
        send(ClientEvent.UPDATE_SETTINGS, finalSettings);
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
          send(ClientEvent.UPDATE_SETTINGS, finalSettings);
        }
      }

      AuthStorage.setSettings(finalSettings);
      store.setSettings(finalSettings);
      store.setMainTab(normalizeMainTab(finalSettings?.main_page));
    }));

    unsubscribers.push(on(ServerEvent.ALL_TODOS, (serverTodos) => {
      const store = useAppStore.getState();
      store.setHistoryLoaded(true);
      const currentSettings = store.settings;
      const startOfToday = getLogicalDayStartMs(
        currentSettings?.reset_time,
        currentSettings?.timezone
      );
      const resetTypes = new Set<string>();

      // Tombstones: если сервер всё ещё знает задачу — повторяем удаление,
      // если уже нет — метку можно снять.
      const tombstones = TombstoneStorage.getAll();
      const tombstoneIds = new Set(tombstones.map(item => item.id));
      const serverIds = new Set(serverTodos.map(item => item.id));
      tombstones.forEach(tombstone => {
        if (serverIds.has(tombstone.id)) {
          send(ClientEvent.DELETE_TODO, tombstone.id);
        } else {
          TombstoneStorage.remove(tombstone.id);
        }
      });

      if (shouldReplaceTodos) {
        shouldReplaceTodos = false;

        const visibleTodos = serverTodos.filter(
          sItem => !tombstoneIds.has(sItem.id)
        );
        const resetResult =
          currentSettings?.reset_enabled !== false
            ? resetStaleTodos(visibleTodos, startOfToday)
            : { todos: visibleTodos, resetTypes: new Set<string>() };

        startTransition(() => {
          store.setTodoList(resetResult.todos);
        });

        resetResult.resetTypes.forEach(type => {
          send(ClientEvent.CONFIRM_RESET, { type, updatedAt: startOfToday });
        });
        return;
      }

      startTransition(() => {
        store.setTodoList(localTodos => {
          const merged = [...localTodos];
          let hasChanges = false;

          serverTodos.forEach(sItem => {
            if (tombstoneIds.has(sItem.id)) return;

            const reset =
              currentSettings?.reset_enabled !== false
                ? resetTodoForNewDay(sItem, startOfToday)
                : null;
            const processedItem = reset ?? { ...sItem };

            if (reset) {
              resetTypes.add(reset.type);
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
                send(ClientEvent.SYNC_TODO, lItem);
              }
            }
          });
          return hasChanges ? merged : localTodos;
        });
      });

      if (resetTypes.size > 0) {
        resetTypes.forEach(type => {
          send(ClientEvent.CONFIRM_RESET, { type, updatedAt: startOfToday });
        });
      }
    }));

    unsubscribers.push(on(ServerEvent.TODO_UPDATED, (updatedTodo) => {
      startTransition(() => {
        useAppStore.getState().setTodoList(prev => {
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
        useAppStore.getState().setTodoList(prev =>
          prev.filter(todo => todo.id !== deletedId)
        );
      });
    }));

    unsubscribers.push(on(ServerEvent.REGISTER_SUCCESS, () => {
      startTransition(() => {
        const store = useAppStore.getState();
        store.setAuthMode('');
        store.setAuthState('login');
      });
    }));

    unsubscribers.push(on(ServerEvent.AUTH_EXPIRED, () => {
      startTransition(() => {
        const store = useAppStore.getState();
        // Истёкшая сессия не должна стирать локальные задачи и историю:
        // пользователь продолжает работать в local-режиме.
        AuthStorage.clearSession();
        // Незавершённый синк прошлого пользователя не должен влиять
        // на следующую сессию.
        shouldReplaceTodos = false;
        onSessionCleared?.();
        socket.auth = {};
        setSyncMode('local');
        store.setAuthMode('local');
        store.setAuthState('login');
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
          useAppStore.getState().setRpgHistory(prev => {
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
        useAppStore.getState().setRpgHistory(prev => {
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
        const store = useAppStore.getState();
        AuthStorage.setSettings(serverSettings);
        store.setSettings(serverSettings);
        store.setMainTab(normalizeMainTab(serverSettings?.main_page));
      });
    }));

    unsubscribers.push(on(ServerEvent.ACK, (ack: AckPayload) => {
      handleAck(ack);
      const { event, status, data } = ack;

      if (status === 'conflict') {
        Toast.show({
          type: 'info',
          text1: 'Синхронизация',
          text2: 'Изменение не применено: на сервере более новая версия',
          visibilityTime: 3000
        });
      }

      const applyServerTodo = (serverTodo: Todo) => {
        startTransition(() => {
          useAppStore.getState().setTodoList(prev => {
            const index = prev.findIndex(t => t.id === serverTodo.id);
            if (index === -1) {
              return [...prev, serverTodo];
            }
            const next = [...prev];
            next[index] = serverTodo;
            return next;
          });
        });
      };

      const removeTodo = (id: string) => {
        startTransition(() => {
          useAppStore.getState().setTodoList(prev =>
            prev.filter(t => t.id !== id)
          );
        });
      };

      const applyServerSettings = (serverSettings: UserSettings) => {
        const store = useAppStore.getState();
        AuthStorage.setSettings(serverSettings);
        store.setSettings(serverSettings);
        store.setMainTab(normalizeMainTab(serverSettings?.main_page));
      };

      const applyServerHistory = (serverEntry: RpgHistoryItem) => {
        startTransition(() => {
          useAppStore.getState().setRpgHistory(prev => {
            const index = prev.findIndex(h => h.date === serverEntry.date);
            if (index === -1) {
              return [...prev, serverEntry];
            }
            const next = [...prev];
            next[index] = serverEntry;
            return next;
          });
        });
      };

      // Сервер — источник истины: и conflict, и applied несут каноничную
      // версию в data, поэтому применяем её к локальным сторам.
      if (event === ClientEvent.SYNC_TODO) {
        if ((status === 'conflict' || status === 'applied') && data) {
          applyServerTodo(data as Todo);
        } else if (status === 'deleted') {
          const deletedId = (data as { id?: string } | null)?.id;
          if (deletedId) {
            removeTodo(deletedId);
          }
        }
      } else if (event === ClientEvent.DELETE_TODO) {
        const deletedId = (data as { id?: string } | null)?.id;
        if (deletedId) {
          TombstoneStorage.remove(deletedId);
          removeTodo(deletedId);
        }
      } else if (event === ClientEvent.UPDATE_SETTINGS) {
        if ((status === 'conflict' || status === 'applied') && data) {
          applyServerSettings(data as UserSettings);
        }
      } else if (event === ClientEvent.SYNC_DAILY_HISTORY) {
        if ((status === 'conflict' || status === 'applied') && data) {
          applyServerHistory(data as RpgHistoryItem);
        }
      } else if (event === ClientEvent.BULK_SYNC_TODOS) {
        const results =
          (data as { results?: BulkResult<Todo>[] } | null)?.results ?? [];
        results.forEach(result => {
          if (result.status === 'deleted') {
            removeTodo(result.id);
          } else if (result.todo) {
            applyServerTodo(result.todo);
          }
        });
      } else if (event === ClientEvent.BULK_DELETE_TODOS) {
        const results =
          (data as { results?: BulkResult<Todo>[] } | null)?.results ?? [];
        results.forEach(result => {
          TombstoneStorage.remove(result.id);
          removeTodo(result.id);
        });
      } else if (event === ClientEvent.BULK_SYNC_DAILY_HISTORY) {
        const results =
          (data as {
            results?: Array<{
              date: string;
              status: AckStatus;
              entry: RpgHistoryItem;
            }>;
          } | null)?.results ?? [];
        results.forEach(result => {
          if (result.entry) {
            applyServerHistory(result.entry);
          }
        });
      }
    }));

    unsubscribers.push(on(ServerEvent.ERROR, (error: ServerErrorPayload) => {
      handleError(error);
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
  }, [onSessionCleared]);
};

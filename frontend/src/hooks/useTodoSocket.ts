import { useEffect, startTransition, Dispatch, SetStateAction } from 'react';
import Toast from 'react-native-toast-message';
import { socket } from '../utils/socket';
import { AckPayload, ServerErrorPayload, request } from '../utils/protocol';
import {
  AuthStorage,
  RpgStorage,
  TodoStorage,
  UserSettings,
  Todo,
  RpgHistoryItem
} from '../utils/storage';
import { getLogicalDayStartMs } from '../utils/date';


interface UseTodoSocketProps {
  setTodoList: Dispatch<SetStateAction<Todo[]>>;
  setAuthMode: (mode: string) => void;
  setAuthState: (state: string) => void;
  setRpgHistory: Dispatch<SetStateAction<RpgHistoryItem[]>>;
  setSettings: (settings: UserSettings) => void;
  settings: UserSettings;
  setMainTab?: (tab: string) => void;
}

export const useTodoSocket = ({
  setTodoList,
  setAuthMode,
  setAuthState,
  setRpgHistory,
  setSettings,
  settings,
  setMainTab
}: UseTodoSocketProps) => {
  useEffect(() => {
    let shouldReplaceTodos = false;
    let shouldReplaceHistory = false;

    socket.on('connect', () => {
      console.log('Connected to Server!');
    });

    socket.on('server:login_success', (data) => {
      const { username, token, settings: serverSettings } = data;

      socket.auth = { username, token };

      shouldReplaceTodos = true;
      shouldReplaceHistory = true;

      const localTodos = TodoStorage.getAll();
      const localHistory = RpgStorage.getHistory();

      socket.emit('client:bulk_sync_todos', request(localTodos));
      socket.emit('client:bulk_sync_daily_history', request(localHistory));

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
        socket.emit('client:update_settings', request(finalSettings));
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
          socket.emit('client:update_settings', request(finalSettings));
        }
      }

      AuthStorage.setSettings(finalSettings);
      setSettings(finalSettings);
      if (setMainTab && finalSettings?.main_page) {
        setMainTab(finalSettings.main_page);
      }
    });

    socket.on('server:all_todos', (serverTodos) => {
      const startOfToday = getLogicalDayStartMs(
        settings?.reset_time,
        settings?.timezone
      );
      const resetTypes = new Set();

      if (shouldReplaceTodos) {
        shouldReplaceTodos = false;

        const processedTodos = serverTodos.map(sItem => {
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
            socket.emit('client:confirm_reset', request({ type, updatedAt: startOfToday }));
          });
        }
        return;
      }

      startTransition(() => {
        setTodoList(localTodos => {
          const merged = [...localTodos];
          let hasChanges = false;

          serverTodos.forEach(sItem => {
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
                socket.emit('client:sync_todo', request(lItem));
              }
            }
          });
          return hasChanges ? merged : localTodos;
        });
      });

      if (resetTypes.size > 0) {
        resetTypes.forEach(type => {
          socket.emit('client:confirm_reset', request({ type, updatedAt: startOfToday }));
        });
      }
    });

    socket.on('server:todo_updated', (updatedTodo) => {
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
    });

    socket.on('server:todo_deleted', (deletedId) => {
      startTransition(() => {
        setTodoList(prev => prev.filter(todo => todo.id !== deletedId));
      });
    });

    socket.on('server:register_success', () => {
      startTransition(() => {
        setAuthMode('');
        setAuthState('login');
      });
    });

    socket.on('server:auth_expired', () => {
      startTransition(() => {
        AuthStorage.logout();
        socket.auth = {};
        setAuthMode('local');
        setAuthState('login');
        setTodoList([]);
        setRpgHistory([]);
        TodoStorage.saveAll([]);
        RpgStorage.saveHistory([]);
        Toast.show({
          type: 'error',
          text1: 'Сессия истекла',
          text2: 'Пожалуйста, авторизуйтесь заново',
          visibilityTime: 4000
        });
      });
    });

    socket.on('server:month_history', (data) => {
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
    });

    socket.on('server:daily_history_updated', (data) => {
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
    });

    socket.on('server:settings_updated', (serverSettings) => {
      startTransition(() => {
        AuthStorage.setSettings(serverSettings);
        setSettings(serverSettings);
        if (setMainTab && serverSettings?.main_page) {
          setMainTab(serverSettings.main_page);
        }
      });
    });

    socket.on('server:ack', (ack: AckPayload) => {
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
        } else if (status === 'deleted' && data?.id) {
          const deletedId = data.id as string;
          startTransition(() => {
            setTodoList(prev => prev.filter(t => t.id !== deletedId));
          });
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
    });

    socket.on('server:error', (error: ServerErrorPayload) => {
      if (error.code === 'unauthorized') {
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Синхронизация',
        text2: error.message,
        visibilityTime: 4000
      });
    });

    return () => {
      socket.off('connect');
      socket.off('server:all_todos');
      socket.off('server:todo_updated');
      socket.off('server:todo_deleted');
      socket.off('server:login_success');
      socket.off('server:register_success');
      socket.off('server:auth_expired');
      socket.off('server:month_history');
      socket.off('server:daily_history_updated');
      socket.off('server:settings_updated');
      socket.off('server:ack');
      socket.off('server:error');
    };
  }, [setTodoList, setAuthMode, setAuthState, setRpgHistory, setSettings, settings, setMainTab]);
};

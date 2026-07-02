import { useEffect, startTransition, Dispatch, SetStateAction } from 'react';
import Toast from 'react-native-toast-message';
import { socket } from '../utils/socket';
import {
  AuthStorage,
  RpgStorage,
  TodoStorage,
  UserSettings,
  Todo,
  RpgHistoryItem
} from '../utils/storage';


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

      socket.emit('client:bulk_sync_todos', localTodos);
      socket.emit('client:bulk_sync_daily_history', localHistory);

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
        socket.emit('client:update_settings', finalSettings);
      } else {
        finalSettings = { ...localSettings, ...serverSettings };
      }

      AuthStorage.setSettings(finalSettings);
      setSettings(finalSettings);
      if (setMainTab && finalSettings?.main_page) {
        setMainTab(finalSettings.main_page);
      }
    });

    socket.on('server:all_todos', (serverTodos) => {
      const resetTimeStr = settings?.reset_time || '00:00';
      const parts = resetTimeStr.split(':').map(Number);
      const timeToReset = (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
        ? [parts[0], parts[1], 0, 0]
        : [0, 0, 0, 0];

      let startOfToday = new Date().setHours(
        timeToReset[0],
        timeToReset[1],
        timeToReset[2],
        timeToReset[3]
      );
      const resetTypes = new Set();

      if (startOfToday > Date.now()) {
        startOfToday -= 86400000;
      }

      if (shouldReplaceTodos) {
        shouldReplaceTodos = false;

        const processedTodos = serverTodos.map(sItem => {
          let processedItem = { ...sItem };
          if (settings?.reset_enabled !== false && (processedItem.type === 'daily' || processedItem.type === 'habit') && processedItem.updatedAt < startOfToday) {
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
            socket.emit('client:confirm_reset', type, startOfToday);
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

            if (settings?.reset_enabled !== false && (processedItem.type === 'daily' || processedItem.type === 'habit') && processedItem.updatedAt < startOfToday) {
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
                socket.emit('client:sync_todo', lItem);
              }
            }
          });
          return hasChanges ? merged : localTodos;
        });
      });

      if (resetTypes.size > 0) {
        resetTypes.forEach(type => {
          socket.emit('client:confirm_reset', type, startOfToday);
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
    };
  }, [setTodoList, setAuthMode, setAuthState, setRpgHistory, setSettings, settings, setMainTab]);
};

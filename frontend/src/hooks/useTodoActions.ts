import { useState, useEffect, useCallback, useRef, SetStateAction } from 'react';
import {
  TodoStorage,
  RpgStorage,
  AuthStorage,
  TombstoneStorage,
  Todo,
  RpgHistoryItem,
  UserSettings,
  TodoType,
  AuthMode
} from '../utils/storage';
import { send } from '../sync';
import { ClientEvent } from '../contract/events';
import {
  getLogicalDateStr,
  getLogicalDayStartMs,
  getNextResetMs,
} from '../utils/date';
import { computeDailyStats } from '../utils/dailyStats';


export const useTodoActions = (
  mainTab: string,
  settings: UserSettings,
  authMode?: AuthMode
) => {
  const [todoList, setTodoList] = useState(() => {
    const local = TodoStorage.getAll();
    const list = Array.isArray(local) ? local : [];

    const localSettings = AuthStorage.getSettings();
    if (localSettings?.reset_enabled !== false) {
      const startOfToday = getLogicalDayStartMs(
        localSettings?.reset_time,
        localSettings?.timezone
      );

      let hasChanges = false;
      const updatedList = list.map(item => {
        if (
          (item.type === 'daily' || item.type === 'habit') &&
          !item.deleted &&
          item.updatedAt < startOfToday
        ) {
          hasChanges = true;
          return {
            ...item,
            progressNow: 0,
            completed: false,
            updatedAt: startOfToday
          };
        }
        return item;
      });

      if (hasChanges) {
        TodoStorage.saveAll(updatedList);
        return updatedList;
      }
    }

    return list;
  });
  const [rpgHistory, setRpgHistory] = useState(() => RpgStorage.getHistory());
  const isHistoryLoadedRef = useRef(!AuthStorage.getToken());
  const rpgHistoryRef = useRef(rpgHistory);
  const lastHistorySyncRef = useRef<string | null>(null);

  useEffect(() => {
    rpgHistoryRef.current = rpgHistory;
  }, [rpgHistory]);

  const resetHistorySync = useCallback(() => {
    lastHistorySyncRef.current = null;
  }, []);

  useEffect(() => {
    // Смена аккаунта/разлогин: при следующем входе историю нужно отправить заново.
    resetHistorySync();
  }, [authMode, resetHistorySync]);

  const setRpgHistoryWrapper = useCallback((value: SetStateAction<RpgHistoryItem[]>) => {
    isHistoryLoadedRef.current = true;
    setRpgHistory(value);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      TodoStorage.saveAll(todoList);
    }, 1000);
    return () => clearTimeout(timer);
  }, [todoList]);

  useEffect(() => {
    RpgStorage.saveHistory(rpgHistory);
  }, [rpgHistory]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextReset = () => {
      const resetEnabled = settings?.reset_enabled !== false;
      if (!resetEnabled) return;

      const resetTimeStr = settings?.reset_time || '00:00';
      const resetAt = getNextResetMs(resetTimeStr, settings?.timezone);
      const msUntilReset = Math.max(0, resetAt - Date.now());

      timerId = setTimeout(() => {
        setTodoList(prev => prev.map(item =>
          (item.type === 'daily' || item.type === 'habit') && !item.deleted
            ? { ...item, progressNow: 0, completed: false, updatedAt: resetAt }
            : item
        ));
        send(ClientEvent.CONFIRM_RESET, { type: 'daily', updatedAt: resetAt });
        send(ClientEvent.CONFIRM_RESET, { type: 'habit', updatedAt: resetAt });

        scheduleNextReset();
      }, msUntilReset);
    };

    scheduleNextReset();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [settings]);

  useEffect(() => {
    if (todoList.length === 0) return;
    if (!isHistoryLoadedRef.current) {
      console.log('Skipping daily history sync: history not loaded yet');
      return;
    }

    const todayStr = getLogicalDateStr(settings?.reset_time, settings?.timezone);
    const stats = computeDailyStats(todoList, todayStr);

    // Эмитим только когда реально изменились цифры дня, а не на каждое
    // изменение списка задач (переименование, порядок и т.п.).
    const signature = JSON.stringify({
      date: todayStr,
      daily_progress: stats.dailyProgress,
      pos_points: stats.posPoints,
      neg_points: stats.negPoints,
      habits_detail: stats.habitsDetail,
    });
    if (lastHistorySyncRef.current === signature) return;
    lastHistorySyncRef.current = signature;

    const existingEntry = rpgHistoryRef.current.find(h => h.date === todayStr);
    const updatedEntry = {
      date: todayStr,
      mood: existingEntry ? existingEntry.mood : null,
      daily_progress: stats.dailyProgress,
      pos_points: stats.posPoints,
      neg_points: stats.negPoints,
      habits_detail: stats.habitsDetail,
      updatedAt: Date.now()
    };

    setRpgHistory(prev => {
      const existingIndex = prev.findIndex(h => h.date === todayStr);
      if (existingIndex !== -1) {
        const newHistory = [...prev];
        newHistory[existingIndex] = updatedEntry;
        return newHistory;
      }
      return [...prev, updatedEntry];
    });

    send(ClientEvent.SYNC_DAILY_HISTORY, updatedEntry);
  }, [todoList, settings?.reset_time, settings?.timezone]);

  const addTask = useCallback((
    task: string,
    progressEnd: number = 1,
    type: TodoType = mainTab as TodoType,
    progressNow: number | string = 0,
    contribution: number = 0,
    days: string = '1111111'
  ) => {
    if (task.trim()) {
      let defaultContrib = contribution;
      if (defaultContrib === 0) {
        if (type === 'todo' || type === mainTab) defaultContrib = 1;
      }
      const newTodo = {
        id: Date.now().toString(),
        text: task.trim(),
        completed: false,
        deleted: false,
        updatedAt: Date.now(),
        type: type,
        progressNow: progressNow,
        progressEnd: progressEnd,
        contribution: defaultContrib,
        days: days,
      };
      setTodoList(prev => [newTodo, ...prev]);
      send(ClientEvent.SYNC_TODO, newTodo);
    }
  }, [mainTab]);

  const deleteToRecycle = useCallback((id: string) => {
    let updated = null;
    setTodoList(prev => {
      return prev.map(todo => {
        if (todo.id === id) {
          updated = { ...todo, deleted: true, updatedAt: Date.now() };
          return updated;
        }
        return todo;
      });
    });
    if (updated) {
      send(ClientEvent.SYNC_TODO, updated);
    }
  }, []);

  const statusChangeTask = useCallback((
    id: string,
    amount: number | 'reset' | 'toggle_complete' = 1,
    field: string = 'episode'
  ) => {
    let updated = null;
    setTodoList(prev => {
      return prev.map(todo => {
        if (todo.id === id) {
          const type = todo.type;

          if (type === 'habit') {
            if (amount === 'reset') {
              updated = {
                ...todo,
                progressNow: 0,
                updatedAt: Date.now()
              };
              return updated;
            }
            const change = Math.abs(amount as number);
            const newProgress = Math.max(0, (parseInt(String(todo.progressNow), 10) || 0) + change);
            updated = {
              ...todo,
              progressNow: newProgress,
              updatedAt: Date.now()
            };
            return updated;
          }

          if (type === 'piggy_bank') {
            const change = amount as number;
            const newProgress = Math.max(0, (parseInt(String(todo.progressNow), 10) || 0) + change);
            updated = {
              ...todo,
              progressNow: newProgress,
              completed: newProgress >= (parseInt(String(todo.progressEnd), 10) || 0),
              updatedAt: Date.now()
            };
            return updated;
          }

          if (type === 'tv_show') {
            if (amount === 'toggle_complete') {
              const wasCompleted = todo.completed;
              updated = {
                ...todo,
                completed: !wasCompleted,
                updatedAt: Date.now()
              };
              return updated;
            }
            let [season, episode] = (todo.progressNow || "1-1").toString().split('-').map(Number);
            if (isNaN(season)) season = 1;
            if (isNaN(episode)) episode = 1;

            const change = amount as number;
            if (field === 'season') {
              season = Math.max(1, season + change);
            } else {
              episode = Math.max(1, episode + change);
            }

            updated = {
              ...todo,
              progressNow: `${season}-${episode}`,
              updatedAt: Date.now()
            };
            return updated;
          }

          if (type === 'movie') {
            const wasCompleted = todo.completed;
            updated = {
              ...todo,
              completed: !wasCompleted,
              progressNow: !wasCompleted ? "1" : "0",
              updatedAt: Date.now()
            };
            return updated;
          }

          if (todo.completed) {
            updated = {
              ...todo,
              progressNow: 0,
              completed: false,
              contribution: 0,
              updatedAt: Date.now()
            };
            return updated;
          } else {
            if (Number(todo.progressEnd) > 1) {
              const nextProgress = Number(todo.progressNow) + 1;
              const completed = nextProgress === Number(todo.progressEnd);
              updated = {
                ...todo,
                progressNow: nextProgress,
                completed: completed,
                contribution: todo.type === 'daily' ? nextProgress : todo.contribution,
                updatedAt: Date.now()
              };
              return updated;
            }
            updated = {
              ...todo,
              progressNow: 1,
              completed: true,
              contribution: todo.type === 'daily' ? 1 : todo.contribution,
              updatedAt: Date.now()
            };
            return updated;
          }
        }
        return todo;
      });
    });
    if (updated) {
      send(ClientEvent.SYNC_TODO, updated);
    }
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodoList(prev => prev.filter(item => item.id !== id));
    // Жёсткое удаление фиксируем локально, чтобы офлайн-удаление
    // не потерялось и дослалось на сервер при reconnect.
    TombstoneStorage.add(id);
    send(ClientEvent.DELETE_TODO, id);
  }, []);

  const editTask = useCallback((id: string, updatedFields: Partial<Todo>) => {
    let updated = null;
    setTodoList(prev => {
      return prev.map(todo => {
        if (todo.id === id) {
          const merged = { ...todo, ...updatedFields, updatedAt: Date.now() };
          if ('progressEnd' in updatedFields || 'progressNow' in updatedFields) {
            const nextProgressEnd = parseInt(String(merged.progressEnd), 10) || 1;
            const nextProgressNow = parseInt(String(merged.progressNow), 10) || 0;
            merged.completed = nextProgressNow >= nextProgressEnd;
          }
          updated = merged;
          return updated;
        }
        return todo;
      });
    });
    if (updated) {
      send(ClientEvent.SYNC_TODO, updated);
    }
  }, []);


  const handleMoodChange = useCallback((moodValue: number) => {
    isHistoryLoadedRef.current = true;
    const todayStr = getLogicalDateStr(settings?.reset_time, settings?.timezone);
    const stats = computeDailyStats(todoList, todayStr);

    setRpgHistory(prev => {
      const existingIndex = prev.findIndex(h => h.date === todayStr);
      const updatedEntry = {
        date: todayStr,
        mood: moodValue,
        daily_progress: stats.dailyProgress,
        pos_points: stats.posPoints,
        neg_points: stats.negPoints,
        habits_detail: stats.habitsDetail,
        updatedAt: Date.now()
      };

      let newHistory;
      if (existingIndex !== -1) {
        newHistory = [...prev];
        newHistory[existingIndex] = updatedEntry;
      } else {
        newHistory = [...prev, updatedEntry];
      }

      send(ClientEvent.SYNC_DAILY_HISTORY, updatedEntry);
      return newHistory;
    });
  }, [todoList, settings]);

  return {
    todoList,
    setTodoList,
    addTask,
    deleteToRecycle,
    statusChangeTask,
    deleteTodo,
    editTask,
    rpgHistory,
    setRpgHistory: setRpgHistoryWrapper,
    handleMoodChange,
    resetHistorySync,
  };
};

import { useState, useEffect, useCallback, useRef, SetStateAction } from 'react';
import {
  TodoStorage,
  RpgStorage,
  AuthStorage,
  Todo,
  RpgHistoryItem,
  UserSettings,
  TodoType
} from '../utils/storage';
import { socket } from '../utils/socket';
import { getLogicalDateStr } from '../utils/date';


export const useTodoActions = (mainTab: string, settings: UserSettings) => {
  const [todoList, setTodoList] = useState(() => {
    const local = TodoStorage.getAll();
    const list = Array.isArray(local) ? local : [];

    const localSettings = AuthStorage.getSettings();
    if (localSettings?.reset_enabled !== false) {
      const resetTimeStr = localSettings?.reset_time || '00:00';
      const parts = resetTimeStr.split(':').map(Number);
      const timeToReset = (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
        ? [parts[0], parts[1], 0, 0]
        : [0, 0, 0, 0];

      let startOfToday = new Date().setHours(
        timeToReset[0],
        timeToReset[1],
        timeToReset[2],
        timeToReset[3],
      );
      if (startOfToday > Date.now()) {
        startOfToday -= 86400000;
      }

      let hasChanges = false;
      const updatedList = list.map(item => {
        if ((item.type === 'daily' || item.type === 'habit') && item.updatedAt < startOfToday) {
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
    let timerId;

    const scheduleNextReset = () => {
      const resetEnabled = settings?.reset_enabled !== false;
      if (!resetEnabled) return;

      const resetTimeStr = settings?.reset_time || '00:00';
      const parts = resetTimeStr.split(':').map(Number);
      const timeToReset = (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
        ? [parts[0], parts[1], 0, 0]
        : [0, 0, 0, 0];

      const now = new Date();
      const tomorrow = new Date(now);

      tomorrow.setHours(
        timeToReset[0],
        timeToReset[1],
        timeToReset[2],
        timeToReset[3],
      );

      if (tomorrow <= now) {
        tomorrow.setDate(tomorrow.getDate() + 1);
      }
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      let toUpdatedAt = Date.now();

      timerId = setTimeout(() => {
        toUpdatedAt = tomorrow.getTime();
        setTodoList(prev => prev.map(item =>
          item.type === 'daily' || item.type === 'habit'
            ? { ...item, progressNow: 0, completed: false, updatedAt: toUpdatedAt }
            : item
        ));
        socket.emit('client:confirm_reset', 'daily', toUpdatedAt);
        socket.emit('client:confirm_reset', 'habit', toUpdatedAt);

        scheduleNextReset();
      }, msUntilMidnight);
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

    const todayStr = getLogicalDateStr(settings?.reset_time);

    const parts = todayStr.split('-').map(Number);
    const logicalDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const logicalDayIdx = (logicalDate.getDay() + 6) % 7; // 0 for Mon, 6 for Sun

    const dailies = todoList.filter(item => {
      if (item.type !== 'daily' || item.deleted) return false;
      const daysStr = item.days || '1111111';
      return daysStr[logicalDayIdx] === '1';
    });

    const hasAnyDaily = todoList.some(item => item.type === 'daily' && !item.deleted);

    let progress = 0.0;
    if (dailies.length > 0) {
      const { needProgress, nowProgress } = dailies.reduce((acc, item) => {
        const need = parseInt(String(item.progressEnd), 10) || 0;
        const now = parseInt(String(item.progressNow), 10) || 0;
        acc.needProgress += need;
        acc.nowProgress += now;
        return acc;
      }, { needProgress: 0, nowProgress: 0 });
      progress = needProgress > 0 ? nowProgress / needProgress : 1.0;
    } else if (hasAnyDaily) {
      progress = 1.0;
    }

    const positiveCount = todoList
      .filter(item => item.type === 'habit' && item.contribution === 1 && !item.deleted)
      .reduce((sum, h) => sum + (parseInt(String(h.progressNow), 10) || 0), 0);
    const negativeCount = todoList
      .filter(item => item.type === 'habit' && item.contribution === -1 && !item.deleted)
      .reduce((sum, h) => sum + (parseInt(String(h.progressNow), 10) || 0), 0);

    const habitsSnapshot = todoList
      .filter(item => item.type === 'habit' && !item.deleted)
      .map(item => ({
        id: item.id,
        text: item.text,
        contribution: item.contribution,
        progressNow: parseInt(String(item.progressNow), 10) || 0
      }));

    setRpgHistory(prev => {
      const existingEntry = prev.find(h => h.date === todayStr);
      const moodValue = existingEntry ? existingEntry.mood : null;

      const updatedEntry = {
        date: todayStr,
        mood: moodValue,
        daily_progress: progress,
        pos_points: positiveCount,
        neg_points: negativeCount,
        habits_detail: JSON.stringify(habitsSnapshot),
        updatedAt: Date.now()
      };

      if (
        existingEntry &&
        existingEntry.daily_progress === progress &&
        existingEntry.pos_points === positiveCount &&
        existingEntry.neg_points === negativeCount &&
        existingEntry.habits_detail === updatedEntry.habits_detail
      ) {
        return prev;
      }

      const existingIndex = prev.findIndex(h => h.date === todayStr);
      let newHistory;
      if (existingIndex !== -1) {
        newHistory = [...prev];
        newHistory[existingIndex] = updatedEntry;
      } else {
        newHistory = [...prev, updatedEntry];
      }

      socket.emit('client:sync_daily_history', updatedEntry);
      return newHistory;
    });
  }, [todoList, settings]);

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
      socket.emit('client:sync_todo', newTodo);
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
      socket.emit('client:sync_todo', updated);
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
      socket.emit('client:sync_todo', updated);
    }
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodoList(prev => {
      const todoToDelete = prev.find(item => item.id === id);
      if (todoToDelete) {
        socket.emit('client:delete_todo', id);
      }
      return prev.filter(item => item.id !== id);
    });
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
      socket.emit('client:sync_todo', updated);
    }
  }, []);


  const handleMoodChange = useCallback((moodValue: number) => {
    isHistoryLoadedRef.current = true;
    const todayStr = getLogicalDateStr(settings?.reset_time);

    const parts = todayStr.split('-').map(Number);
    const logicalDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const logicalDayIdx = (logicalDate.getDay() + 6) % 7;

    const dailies = todoList.filter(item => {
      if (item.type !== 'daily' || item.deleted) return false;
      const daysStr = item.days || '1111111';
      return daysStr[logicalDayIdx] === '1';
    });

    const hasAnyDaily = todoList.some(item => item.type === 'daily' && !item.deleted);

    let progress = 0.0;
    if (dailies.length > 0) {
      const { needProgress, nowProgress } = dailies.reduce((acc, item) => {
        acc.needProgress += (Number(item.progressEnd) || 0);
        acc.nowProgress += (Number(item.progressNow) || 0);
        return acc;
      }, { needProgress: 0, nowProgress: 0 });
      progress = needProgress > 0 ? nowProgress / needProgress : 1.0;
    } else if (hasAnyDaily) {
      progress = 1.0;
    }

    const positiveCount = todoList
      .filter(item => item.type === 'habit' && item.contribution === 1 && !item.deleted)
      .reduce((sum, h) => sum + (parseInt(String(h.progressNow), 10) || 0), 0);
    const negativeCount = todoList
      .filter(item => item.type === 'habit' && item.contribution === -1 && !item.deleted)
      .reduce((sum, h) => sum + (parseInt(String(h.progressNow), 10) || 0), 0);

    const habitsSnapshot = todoList
      .filter(item => item.type === 'habit' && !item.deleted)
      .map(item => ({
        id: item.id,
        text: item.text,
        contribution: item.contribution,
        progressNow: parseInt(String(item.progressNow), 10) || 0
      }));

    setRpgHistory(prev => {
      const existingIndex = prev.findIndex(h => h.date === todayStr);
      const updatedEntry = {
        date: todayStr,
        mood: moodValue,
        daily_progress: progress,
        pos_points: positiveCount,
        neg_points: negativeCount,
        habits_detail: JSON.stringify(habitsSnapshot),
        updatedAt: Date.now()
      };

      let newHistory;
      if (existingIndex !== -1) {
        newHistory = [...prev];
        newHistory[existingIndex] = updatedEntry;
      } else {
        newHistory = [...prev, updatedEntry];
      }

      socket.emit('client:sync_daily_history', updatedEntry);
      return newHistory;
    });
  }, [todoList]);

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
  };
};

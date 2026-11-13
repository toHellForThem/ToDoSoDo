import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCommands, useScope } from '../commands';
import type { Command } from '../commands';
import { useTranslation } from '../utils/LanguageContext';
import {
  computeHabitPoints,
  parseHabitsDetail,
  type DailyStats,
} from '../domain/daily';
import type { RpgHistoryItem } from '../utils/storage';
import type {
  CalendarCell,
  SelectedDayDetail,
} from '../components/CalendarModal';
import { formatMonthKey } from '../sync/history';
import { useMonthHistory } from './useMonthHistory';

type Translate = ReturnType<typeof useTranslation>['t'];

interface UseRpgCalendarOptions {
  rpgHistory: RpgHistoryItem[];
  todayStr: string;
  stats: DailyStats;
  isCalendarVisible: boolean;
  t: Translate;
}

/**
 * Состояние календаря RPG: месяц, выбранный день, сетка, детали дня
 * и команды навигации по дням/неделям.
 */
export const useRpgCalendar = ({
  rpgHistory,
  todayStr,
  stats,
  isCalendarVisible,
  t,
}: UseRpgCalendarOptions) => {
  const [selectedDayDetail, setSelectedDayDetail] =
    useState<SelectedDayDetail | null>(null);
  const [isHabitsExpanded, setIsHabitsExpanded] = useState(false);

  // Календарь и заголовок даты живут в том же логическом дне, что и задачи.
  const today = useMemo(() => {
    const [year, month, day] = todayStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [todayStr]);

  const [viewDate, setViewDate] = useState(() => {
    const [year, month, day] = todayStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  });

  useEffect(() => {
    if (isCalendarVisible) {
      setViewDate(today);
    }
  }, [isCalendarVisible, today]);

  const viewMonth = useMemo(() => formatMonthKey(viewDate), [viewDate]);
  const { status: monthHistoryStatus, retry: retryMonthHistory } =
    useMonthHistory(viewMonth, isCalendarVisible);

  const handlePrevMonth = () => {
    setViewDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(1);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
    setSelectedDayDetail(null);
    setIsHabitsExpanded(false);
  };

  const handleNextMonth = () => {
    setViewDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(1);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
    setSelectedDayDetail(null);
    setIsHabitsExpanded(false);
  };

  const todayMonthGenitive = useMemo(
    () => t('months_genitive')[today.getMonth()],
    [today, t],
  );

  const currentMonthName = useMemo(
    () => t('months')[viewDate.getMonth()],
    [viewDate, t],
  );

  const selectedDayMonthGenitive = useMemo(() => {
    if (!selectedDayDetail?.dateStr) return '';
    const parts = selectedDayDetail.dateStr.split('-');
    const m = parseInt(parts[1], 10) - 1;
    return t('months_genitive')[m] || '';
  }, [selectedDayDetail, t]);

  const calendarCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const cells: CalendarCell[] = [];
    for (let i = 0; i < offset; i++) {
      cells.push({ day: null, dateStr: null });
    }
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ day, dateStr });
    }
    return cells;
  }, [viewDate]);

  const handleDayPress = useCallback(
    (cell: CalendarCell) => {
      if (!cell.dateStr) return;
      const log = rpgHistory.find(h => h.date === cell.dateStr);
      setSelectedDayDetail({
        dateStr: cell.dateStr,
        day: cell.day as number,
        log: log || {
          date: cell.dateStr || '',
          mood: null,
          daily_progress: 0,
          pos_points: 0,
          neg_points: 0,
          habits_detail: '[]',
          updatedAt: 0,
        },
      });
      setIsHabitsExpanded(false);
    },
    [rpgHistory],
  );

  const calendarCommands = useMemo<Command[]>(() => {
    const navigateDay = (offset: number) => {
      let targetCell = null;
      if (!selectedDayDetail?.dateStr) {
        targetCell = calendarCells.find(c => c.dateStr === todayStr);
        if (!targetCell) {
          targetCell = calendarCells.find(c => c.day !== null);
        }
      } else {
        const currentIndex = calendarCells.findIndex(
          c => c.dateStr === selectedDayDetail.dateStr,
        );
        if (currentIndex !== -1) {
          const targetIndex = currentIndex + offset;
          if (targetIndex >= 0 && targetIndex < calendarCells.length) {
            const cell = calendarCells[targetIndex];
            if (cell && cell.day !== null) {
              targetCell = cell;
            }
          }
        }
      }

      if (targetCell) {
        handleDayPress(targetCell);
      }
    };

    return [
      {
        id: 'calendar.prevDay',
        title: 'Previous day',
        shortcut: 'arrowleft',
        scope: 'rpg.calendar',
        run: () => navigateDay(-1),
      },
      {
        id: 'calendar.nextDay',
        title: 'Next day',
        shortcut: 'arrowright',
        scope: 'rpg.calendar',
        run: () => navigateDay(1),
      },
      {
        id: 'calendar.prevWeek',
        title: 'Previous week',
        shortcut: 'arrowup',
        scope: 'rpg.calendar',
        run: () => navigateDay(-7),
      },
      {
        id: 'calendar.nextWeek',
        title: 'Next week',
        shortcut: 'arrowdown',
        scope: 'rpg.calendar',
        run: () => navigateDay(7),
      },
      {
        id: 'calendar.toggleHabits',
        title: 'Toggle habits',
        shortcut: 'enter',
        scope: 'rpg.calendar',
        run: () => setIsHabitsExpanded(prev => !prev),
      },
      {
        id: 'calendar.toggleHabits.space',
        title: 'Toggle habits',
        shortcut: 'space',
        scope: 'rpg.calendar',
        run: () => setIsHabitsExpanded(prev => !prev),
      },
    ];
  }, [calendarCells, selectedDayDetail, handleDayPress, todayStr]);

  useCommands(calendarCommands);
  useScope('rpg.calendar', isCalendarVisible);

  const isTodaySelected = selectedDayDetail?.dateStr === todayStr;
  const displayProgress = isTodaySelected
    ? Math.round(stats.dailyProgress * 100)
    : Math.round((selectedDayDetail?.log?.daily_progress || 0) * 100);

  const dayHabits = useMemo(() => {
    if (!selectedDayDetail) return [];
    if (selectedDayDetail.dateStr === todayStr) {
      return stats.habits.filter(h => h.progressNow !== 0);
    }
    return parseHabitsDetail(selectedDayDetail.log?.habits_detail).filter(
      h => h.progressNow !== 0,
    );
  }, [selectedDayDetail, todayStr, stats.habits]);

  // Очки считаем из `habits_detail` и для сегодня, и для прошлых дней —
  // так дневная сводка не расходится с архивом.
  const dayPoints = useMemo(() => {
    if (!selectedDayDetail) {
      return { posPoints: 0, negPoints: 0, neutralPoints: 0 };
    }
    if (selectedDayDetail.dateStr === todayStr) {
      return {
        posPoints: stats.posPoints,
        negPoints: stats.negPoints,
        neutralPoints: stats.neutralPoints,
      };
    }

    const habits = parseHabitsDetail(selectedDayDetail.log?.habits_detail);
    if (habits.length > 0) {
      return computeHabitPoints(habits);
    }

    // Старые записи без `habits_detail`: используем сохранённые агрегаты.
    return {
      posPoints: selectedDayDetail.log?.pos_points || 0,
      negPoints: selectedDayDetail.log?.neg_points || 0,
      neutralPoints: 0,
    };
  }, [selectedDayDetail, todayStr, stats]);

  const selectedDateStr = selectedDayDetail?.dateStr;
  useEffect(() => {
    if (!selectedDateStr) return;
    const log = rpgHistory.find(h => h.date === selectedDateStr);

    setSelectedDayDetail(prev => {
      if (!prev || prev.dateStr !== selectedDateStr) return prev;
      if (!log || prev.log === log) return prev;
      if (
        prev.log.updatedAt === log.updatedAt &&
        prev.log.mood === log.mood &&
        prev.log.daily_progress === log.daily_progress &&
        prev.log.pos_points === log.pos_points &&
        prev.log.neg_points === log.neg_points &&
        prev.log.habits_detail === log.habits_detail
      ) {
        return prev;
      }
      return { ...prev, log };
    });
  }, [rpgHistory, selectedDateStr, setSelectedDayDetail]);

  return {
    today,
    viewDate,
    viewMonth,
    monthHistoryStatus,
    retryMonthHistory,
    selectedDayDetail,
    setSelectedDayDetail,
    isHabitsExpanded,
    setIsHabitsExpanded,
    handlePrevMonth,
    handleNextMonth,
    calendarCells,
    handleDayPress,
    todayMonthGenitive,
    currentMonthName,
    selectedDayMonthGenitive,
    displayProgress,
    displayPosPoints: dayPoints.posPoints,
    displayNegPoints: dayPoints.negPoints,
    displayNeuPoints: dayPoints.neutralPoints,
    dayHabits,
  };
};

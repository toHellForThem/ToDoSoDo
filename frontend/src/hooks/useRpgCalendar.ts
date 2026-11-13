import { useEffect, useMemo, useState } from 'react';
import { useCommands, useScope } from '../commands';
import type { Command } from '../commands';
import { useTranslation } from '../utils/LanguageContext';
import { parseHabitsDetail, type DailyStats } from '../domain/daily';
import type { RpgHistoryItem } from '../utils/storage';
import type { CalendarCell, SelectedDayDetail } from '../components/CalendarModal';

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
  const [selectedDayDetail, setSelectedDayDetail] = useState<SelectedDayDetail | null>(null);
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

  const todayMonthGenitive = useMemo(() => t('months_genitive')[today.getMonth()], [today, t]);

  const currentMonthName = useMemo(() => t('months')[viewDate.getMonth()], [viewDate, t]);

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

  const handleDayPress = (cell: CalendarCell) => {
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
        updatedAt: 0
      }
    });
    setIsHabitsExpanded(false);
  };

  const calendarCommands = useMemo<Command[]>(() => {
    const navigateDay = (offset: number) => {
      let targetCell = null;
      if (!selectedDayDetail?.dateStr) {
        targetCell = calendarCells.find(c => c.dateStr === todayStr);
        if (!targetCell) {
          targetCell = calendarCells.find(c => c.day !== null);
        }
      } else {
        const currentIndex = calendarCells.findIndex(c => c.dateStr === selectedDayDetail.dateStr);
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
  }, [calendarCells, selectedDayDetail, todayStr]);

  useCommands(calendarCommands);
  useScope('rpg.calendar', isCalendarVisible);

  const isTodaySelected = selectedDayDetail?.dateStr === todayStr;
  const displayProgress = isTodaySelected
    ? Math.round(stats.dailyProgress * 100)
    : Math.round((selectedDayDetail?.log?.daily_progress || 0) * 100);
  const displayPosPoints = isTodaySelected
    ? stats.posPoints
    : (selectedDayDetail?.log?.pos_points || 0);
  const displayNegPoints = isTodaySelected
    ? stats.negPoints
    : (selectedDayDetail?.log?.neg_points || 0);

  const dayHabits = useMemo(() => {
    if (!selectedDayDetail) return [];
    if (selectedDayDetail.dateStr === todayStr) {
      return stats.habits.filter(h => h.progressNow !== 0);
    }
    return parseHabitsDetail(selectedDayDetail.log?.habits_detail).filter(
      h => h.progressNow !== 0
    );
  }, [selectedDayDetail, todayStr, stats.habits]);

  const displayNeuPoints = useMemo(() => {
    if (selectedDayDetail?.dateStr === todayStr) {
      return stats.neutralPoints;
    }
    return dayHabits
      .filter(h => h.contribution === 0)
      .reduce((sum, h) => sum + h.progressNow, 0);
  }, [selectedDayDetail, todayStr, stats.neutralPoints, dayHabits]);

  return {
    today,
    viewDate,
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
    displayPosPoints,
    displayNegPoints,
    displayNeuPoints,
    dayHabits,
  };
};

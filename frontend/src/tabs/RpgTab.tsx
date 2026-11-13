import {
  useState,
  useEffect,
  useMemo,
  useRef,
  memo
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Keyboard,
  LayoutAnimation,
  Platform,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getStyles } from './RpgTab.styles';
import { useAppTheme, useStyles } from '../theme/ThemeContext';
import { parseHabitsDetail } from '../domain/daily';
import { selectVisibleTodos } from '../domain/visibility';
import { useTranslation } from '../utils/LanguageContext';
import { useLogicalDateStr, useLogicalDayIndex } from '../hooks/useLogicalDate';
import { useDailyStats } from '../hooks/useDailyStats';
import { CalendarModal, SelectedDayDetail, CalendarCell } from '../components/CalendarModal';
import { HabitsSubtab } from './rpg/HabitsSubtab';
import { PiggyBankSubtab } from './rpg/PiggyBankSubtab';
import { TvShowsSubtab } from './rpg/TvShowsSubtab';
import { useCommands, useScope } from '../commands';
import type { Command } from '../commands';
import { useLeftAction } from '../hooks/useLeftAction';
import { useAppStore } from '../store/appStore';


interface MoodConfigItem {
  icon: string;
  color: string;
  glassBg: string;
  dashboardBg: string;
  label: string;
}

export const RpgTab = memo(() => {
  const rpgHistory = useAppStore(state => state.rpgHistory);
  const todoList = useAppStore(state => state.todoList);
  const deleteToRecycle = useAppStore(state => state.handleDeleteTodo);
  const addTask = useAppStore(state => state.addTask);
  const statusChangeTask = useAppStore(state => state.statusChangeTask);
  const subtab = useAppStore(state => state.rpgSubtab);
  const setSubtab = useAppStore(state => state.setRpgSubtab);
  const isCalendarVisible = useAppStore(state => state.isCalendarVisible);
  const setCalendarVisible = useAppStore(state => state.setCalendarVisible);
  const settings = useAppStore(state => state.settings);
  const showIsMovie = useAppStore(state => state.showIsMovie);
  const setShowIsMovie = useAppStore(state => state.setShowIsMovie);
  const showStartEpisode = useAppStore(state => state.showStartEpisode);
  const setShowStartEpisode = useAppStore(state => state.setShowStartEpisode);
  const focusedGoalId = useAppStore(state => state.focusedGoalId);
  const setFocusedGoalId = useAppStore(state => state.setFocusedGoalId);
  const flashingGoalId = useAppStore(state => state.flashingGoalId);
  const piggyInputs = useAppStore(state => state.piggyInputs);
  const setPiggyInputs = useAppStore(state => state.setPiggyInputs);
  const handleUpdatePiggy = useAppStore(state => state.handleUpdatePiggy);
  const selectedTaskId = useAppStore(state => state.selectedTaskId);
  const isActive = useAppStore(state => state.mainTab === 'rpg');
  const leftAction = useLeftAction();
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;
  const styles = useStyles(getStyles);
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const isDark = settings?.theme === 'dark';

  const activeMoodConfig = useMemo<Record<number, MoodConfigItem>>(() => {
    const isMint = settings?.theme === 'mint';
    const isPink = settings?.theme === 'pink';
    if (isDark) {
      return {
        1: { icon: 'emoticon-dead-outline', color: '#94A3B8', glassBg: '#334155', dashboardBg: '#1E293B', label: t('mood_1') },
        2: { icon: 'emoticon-sad-outline', color: '#FB7185', glassBg: '#4c0519', dashboardBg: '#881337', label: t('mood_2') },
        3: { icon: 'emoticon-neutral-outline', color: '#F59E0B', glassBg: '#451a03', dashboardBg: '#78350f', label: t('mood_3') },
        4: { icon: 'emoticon-happy-outline', color: '#34D399', glassBg: '#064e3b', dashboardBg: '#065f46', label: t('mood_4') },
        5: { icon: 'emoticon-excited-outline', color: '#C084FC', glassBg: '#2e1065', dashboardBg: '#4c1d95', label: t('mood_5') },
      };
    } else if (isMint) {
      return {
        1: { icon: 'emoticon-dead-outline', color: '#64748B', glassBg: '#EDF2F7', dashboardBg: '#E2E8F0', label: t('mood_1') },
        2: { icon: 'emoticon-sad-outline', color: '#F43F5E', glassBg: '#FFE4E6', dashboardBg: '#FECDD3', label: t('mood_2') },
        3: { icon: 'emoticon-neutral-outline', color: '#D98A2F', glassBg: '#FEF3C7', dashboardBg: '#FDE68A', label: t('mood_3') },
        4: { icon: 'emoticon-happy-outline', color: '#10B981', glassBg: '#D1FAE5', dashboardBg: '#A7F3D0', label: t('mood_4') },
        5: { icon: 'emoticon-excited-outline', color: '#8B5CF6', glassBg: '#EDE9FE', dashboardBg: '#DDD6FE', label: t('mood_5') },
      };
    } else if (isPink) {
      return {
        1: { icon: 'emoticon-dead-outline', color: '#64748B', glassBg: '#EDF2F7', dashboardBg: '#E2E8F0', label: t('mood_1') },
        2: { icon: 'emoticon-sad-outline', color: '#F43F5E', glassBg: '#FFE4E6', dashboardBg: '#FFD2E2', label: t('mood_2') },
        3: { icon: 'emoticon-neutral-outline', color: '#D98A2F', glassBg: '#FEF3C7', dashboardBg: '#FFEBC4', label: t('mood_3') },
        4: { icon: 'emoticon-happy-outline', color: '#10B981', glassBg: '#D1FAE5', dashboardBg: '#E6F4EA', label: t('mood_4') },
        5: { icon: 'emoticon-excited-outline', color: '#D946EF', glassBg: '#FDF4FF', dashboardBg: '#FAE8FF', label: t('mood_5') },
      };
    } else {
      return {
        1: { icon: 'emoticon-dead-outline', color: '#64748B', glassBg: '#EDF2F7', dashboardBg: '#CBD9EF', label: t('mood_1') },
        2: { icon: 'emoticon-sad-outline', color: '#F43F5E', glassBg: '#FFE4E6', dashboardBg: '#DCD2E9', label: t('mood_2') },
        3: { icon: 'emoticon-neutral-outline', color: '#D98A2F', glassBg: '#FEF3C7', dashboardBg: '#D9DCE4', label: t('mood_3') },
        4: { icon: 'emoticon-happy-outline', color: '#10B981', glassBg: '#D1FAE5', dashboardBg: '#C1E1EE', label: t('mood_4') },
        5: { icon: 'emoticon-excited-outline', color: '#8B5CF6', glassBg: '#EDE9FE', dashboardBg: '#CFD6FC', label: t('mood_5') },
      };
    }
  }, [isDark, settings?.theme, t]);

  const [selectedDayDetail, setSelectedDayDetail] = useState<SelectedDayDetail | null>(null);
  const [isHabitsExpanded, setIsHabitsExpanded] = useState(false);

  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const flatListRef = useRef<any>(null);
  const currentScrollY = useRef(0);

  const todayStr = useLogicalDateStr();
  const todayDayIdx = useLogicalDayIndex();
  const stats = useDailyStats();

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

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setKeyboardVisible(true);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    });
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      setFocusedGoalId(null);

      const activeInput = TextInput.State.currentlyFocusedInput();
      if (activeInput) {
        TextInput.State.blurTextInput(activeInput);
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const activeShows = useMemo(() =>
    todoList.filter(item => (item.type === 'tv_show' || item.type === 'movie') && !item.deleted),
    [todoList]
  );

  const piggyGoalItems = useMemo(() =>
    todoList.filter(item => item.type === 'piggy_bank' && !item.deleted),
    [todoList]
  );

  const focusedIndex = useMemo(() => {
    if (!focusedGoalId) return -1;
    return piggyGoalItems.findIndex(item => item.id === focusedGoalId);
  }, [focusedGoalId, piggyGoalItems]);

  useEffect(() => {
    if (isKeyboardVisible) {
      if (focusedIndex >= 1 && flatListRef.current) {
        const timer = setTimeout(() => {
          try {
            flatListRef.current.scrollToIndex({
              index: focusedIndex,
              viewPosition: 0.2,
              animated: true,
            });
          } catch (err) {
            try {
              flatListRef.current.scrollToOffset({
                offset: focusedIndex * 70,
                animated: true,
              });
            } catch {
              // FlatList может не успеть измерить элемент — фолбэк уже применён.
            }
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    } else {
      if (flatListRef.current && currentScrollY.current > 0) {
        const timer = setTimeout(() => {
          try {
            flatListRef.current.scrollToOffset({
              offset: currentScrollY.current,
              animated: true,
            });
          } catch {
            // Позиция скролла могла устареть после перестроения списка.
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isKeyboardVisible, focusedIndex]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isKeyboardVisible) {
      currentScrollY.current = event.nativeEvent.contentOffset.y;
    }
  };

  const dailyStats = useMemo(() => ({
    dailiesProgress: Math.round(stats.dailyProgress * 100),
    positiveCount: stats.posPoints,
    negativeCount: stats.negPoints,
    neutralCount: stats.neutralPoints,
  }), [stats]);

  const todayMood = useMemo(() => {
    const todayLog = rpgHistory.find(h => h.date === todayStr);
    return todayLog ? todayLog.mood : null;
  }, [rpgHistory, todayStr]);

  const isTodaySelected = selectedDayDetail?.dateStr === todayStr;
  const displayProgress = isTodaySelected
    ? dailyStats.dailiesProgress
    : Math.round((selectedDayDetail?.log?.daily_progress || 0) * 100);
  const displayPosPoints = isTodaySelected
    ? dailyStats.positiveCount
    : (selectedDayDetail?.log?.pos_points || 0);
  const displayNegPoints = isTodaySelected
    ? dailyStats.negativeCount
    : (selectedDayDetail?.log?.neg_points || 0);

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
  }, [calendarCells, selectedDayDetail, handleDayPress, setIsHabitsExpanded, todayStr]);

  useCommands(calendarCommands);
  useScope('rpg.calendar', isCalendarVisible);

  const handleAddHabit = (name: string, type: 'positive' | 'negative' | 'neutral') => {
    addTask(
      name.trim(),
      1,
      'habit',
      0,
      type === 'positive' ? 1 : type === 'negative' ? -1 : 0
    );
    Keyboard.dismiss();
  };

  const handleSavePiggyGoal = (name: string, target: string) => {
    addTask(name.trim(), parseInt(target, 10) || 0, 'piggy_bank', 0);
    Keyboard.dismiss();
  };


  const handleAddShow = (title: string, isMovie: boolean, startEp: string) => {
    const epNum = parseInt(startEp, 10) || 1;
    addTask(title.trim(), 1, isMovie ? 'movie' : 'tv_show', isMovie ? "0" : `1-${epNum}`);
    Keyboard.dismiss();
  };

  const renderSwipeLeft = (progress: any, drag: any) => {
    return leftAction(progress, drag, 'toRecycle');
  };

  const allHabits = useMemo(() =>
    selectVisibleTodos(todoList, {
      mainTab: 'rpg',
      rpgSubtab: 'habits',
      recycle: false,
      dayIndex: todayDayIdx,
    }),
    [todoList, todayDayIdx]
  );

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

  if (subtab === 'habits') {
    return (
      <HabitsSubtab
        allHabits={allHabits}
        handleAddHabit={handleAddHabit}
        statusChangeTask={statusChangeTask}
        deleteToRecycle={deleteToRecycle}
        renderSwipeLeft={renderSwipeLeft}
        styles={styles}
        theme={theme}
        selectedTaskId={selectedTaskId}
        isActive={isActive && subtab === 'habits'}
      />
    );
  }

  if (subtab === 'piggy_bank') {
    return (
      <PiggyBankSubtab
        piggyGoalItems={piggyGoalItems}
        focusedGoalId={focusedGoalId}
        setFocusedGoalId={setFocusedGoalId}
        flashingGoalId={flashingGoalId}
        isKeyboardVisible={isKeyboardVisible}
        keyboardHeight={keyboardHeight}
        handleSavePiggyGoal={handleSavePiggyGoal}
        handleUpdatePiggy={handleUpdatePiggy}
        handleScroll={handleScroll}
        flatListRef={flatListRef}
        deleteToRecycle={deleteToRecycle}
        renderSwipeLeft={renderSwipeLeft}
        styles={styles}
        theme={theme}
        piggyInputs={piggyInputs}
        setPiggyInputs={setPiggyInputs}
        selectedTaskId={selectedTaskId}
        isActive={isActive && subtab === 'piggy_bank'}
      />
    );
  }

  if (subtab === 'tv_shows') {
    return (
      <TvShowsSubtab
        activeShows={activeShows}
        keyboardHeight={keyboardHeight}
        isKeyboardVisible={isKeyboardVisible}
        handleAddShow={handleAddShow}
        statusChangeTask={statusChangeTask}
        deleteToRecycle={deleteToRecycle}
        renderSwipeLeft={renderSwipeLeft}
        styles={styles}
        theme={theme}
        showIsMovie={showIsMovie}
        setShowIsMovie={setShowIsMovie}
        showStartEpisode={showStartEpisode}
        setShowStartEpisode={setShowStartEpisode}
        isWideScreen={isWideScreen}
        selectedTaskId={selectedTaskId}
        isActive={isActive && subtab === 'tv_shows'}
      />
    );
  }

  const hasTodayMood = todayMood && activeMoodConfig[todayMood];
  const dateBtnBg = hasTodayMood ? activeMoodConfig[todayMood].dashboardBg : theme.colors.surface;
  const dateBtnBorder = hasTodayMood ? activeMoodConfig[todayMood].color : theme.colors.primary;
  const dateBtnTextColor = hasTodayMood ? activeMoodConfig[todayMood].color : theme.colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.dashboardContainer}>
        <View style={styles.centralDateBlock}>
          <View style={styles.dashboardRow}>
            <TouchableOpacity
              style={[
                styles.dateButton,
                {
                  backgroundColor: dateBtnBg,
                  borderColor: dateBtnBorder,
                }
              ]}
              onPress={() => setCalendarVisible(true)}
            >
              <Text style={[styles.dateNumber, { color: dateBtnTextColor }]}>{today.getDate()}</Text>
              <Text style={[styles.dateMonth, { color: dateBtnTextColor }]}>{todayMonthGenitive}</Text>
            </TouchableOpacity>

            <View style={styles.dashboardStatsColumn}>
              <View style={styles.statItemRow}>
                <Text style={styles.statLabel}>{t('rpg_stat_progress')}</Text>
                <Text style={styles.statValue}>{dailyStats.dailiesProgress}%</Text>
              </View>
              <View style={styles.statItemRow}>
                <Text style={styles.statLabel}>{t('rpg_stat_habits')}</Text>
                <View style={styles.statHabitsValueContainer}>
                  <Text style={[styles.statValue, { color: '#34D399' }]}>+{dailyStats.positiveCount}</Text>
                  <Text style={[styles.statValue, { color: '#94A3B8', marginHorizontal: 8 }]}>{dailyStats.neutralCount}</Text>
                  <Text style={[styles.statValue, { color: '#EF4444' }]}>-{dailyStats.negativeCount}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.menuCard} onPress={() => setSubtab('habits')}>
            <View style={styles.menuIconContainer}>
              <MaterialCommunityIcons name="shield-star-outline" size={45} color={theme.colors.icon.primary} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>{t('rpg_menu_habits')}</Text>
              <Text style={styles.menuSubtitle}>{t('rpg_menu_habits_desc')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => setSubtab('piggy_bank')}>
            <View style={styles.menuIconContainer}>
              <MaterialCommunityIcons name="piggy-bank-outline" size={45} color={theme.colors.icon.primary} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>{t('rpg_menu_piggy')}</Text>
              <Text style={styles.menuSubtitle}>{t('rpg_menu_piggy_desc')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => setSubtab('tv_shows')}>
            <View style={styles.menuIconContainer}>
              <MaterialCommunityIcons name="television-play" size={45} color={theme.colors.icon.primary} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>{t('rpg_menu_tv')}</Text>
              <Text style={styles.menuSubtitle}>{t('rpg_menu_tv_desc')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <CalendarModal
        isCalendarVisible={isCalendarVisible}
        setCalendarVisible={setCalendarVisible}
        currentMonthName={currentMonthName}
        viewDate={viewDate}
        calendarCells={calendarCells}
        selectedDayDetail={selectedDayDetail}
        setSelectedDayDetail={setSelectedDayDetail}
        isHabitsExpanded={isHabitsExpanded}
        setIsHabitsExpanded={setIsHabitsExpanded}
        displayProgress={displayProgress}
        displayPosPoints={displayPosPoints}
        displayNegPoints={displayNegPoints}
        displayNeuPoints={displayNeuPoints}
        dayHabits={dayHabits}
        activeMoodConfig={activeMoodConfig}
        rpgHistory={rpgHistory}
        todayStr={todayStr}
        selectedDayMonthGenitive={selectedDayMonthGenitive}
        handlePrevMonth={handlePrevMonth}
        handleNextMonth={handleNextMonth}
        handleDayPress={handleDayPress}
        styles={styles}
        theme={theme}
        t={t}
      />
    </View>
  );
});

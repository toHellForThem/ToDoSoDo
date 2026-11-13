import {
  useState,
  useEffect,
  useMemo,
  useRef,
  memo
} from 'react';
import {
  View,
  Keyboard,
  LayoutAnimation,
  Platform,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions
} from 'react-native';
import { getStyles } from './RpgTab.styles';
import { useAppTheme, useStyles } from '../theme/ThemeContext';
import { selectVisibleTodos } from '../domain/visibility';
import { getMoodConfig, type MoodConfigItem } from '../domain/moods';
import { useTranslation } from '../utils/LanguageContext';
import { useLogicalDateStr, useLogicalDayIndex } from '../hooks/useLogicalDate';
import { useDailyStats } from '../hooks/useDailyStats';
import { useRpgCalendar } from '../hooks/useRpgCalendar';
import { CalendarModal } from '../components/CalendarModal';
import { HabitsSubtab } from './rpg/HabitsSubtab';
import { PiggyBankSubtab } from './rpg/PiggyBankSubtab';
import { TvShowsSubtab } from './rpg/TvShowsSubtab';
import { RpgDashboard } from './rpg/RpgDashboard';
import { useLeftAction } from '../hooks/useLeftAction';
import { useAppStore } from '../store/appStore';

const MOOD_LABEL_KEYS = ['mood_1', 'mood_2', 'mood_3', 'mood_4', 'mood_5'] as const;

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

  const activeMoodConfig = useMemo(() => {
    const config = getMoodConfig(settings?.theme);
    const result: Record<number, MoodConfigItem & { label: string }> = {};
    Object.values(config).forEach(item => {
      result[item.value] = { ...item, label: t(MOOD_LABEL_KEYS[item.value - 1]) };
    });
    return result;
  }, [settings?.theme, t]);

  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const flatListRef = useRef<any>(null);
  const currentScrollY = useRef(0);

  const todayStr = useLogicalDateStr();
  const todayDayIdx = useLogicalDayIndex();
  const stats = useDailyStats();

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
  }, [setFocusedGoalId]);

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

  const calendar = useRpgCalendar({
    rpgHistory,
    todayStr,
    stats,
    isCalendarVisible,
    t,
  });

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

  return (
    <View style={styles.container}>
      <RpgDashboard
        today={calendar.today}
        todayMonthGenitive={calendar.todayMonthGenitive}
        dailyStats={dailyStats}
        todayMood={todayMood}
        activeMoodConfig={activeMoodConfig}
        onOpenCalendar={() => setCalendarVisible(true)}
        onSelectSubtab={setSubtab}
        styles={styles}
        theme={theme}
        t={t}
      />

      <CalendarModal
        isCalendarVisible={isCalendarVisible}
        setCalendarVisible={setCalendarVisible}
        currentMonthName={calendar.currentMonthName}
        viewDate={calendar.viewDate}
        monthHistoryStatus={calendar.monthHistoryStatus}
        onRetryMonthHistory={calendar.retryMonthHistory}
        calendarCells={calendar.calendarCells}
        selectedDayDetail={calendar.selectedDayDetail}
        setSelectedDayDetail={calendar.setSelectedDayDetail}
        isHabitsExpanded={calendar.isHabitsExpanded}
        setIsHabitsExpanded={calendar.setIsHabitsExpanded}
        displayProgress={calendar.displayProgress}
        displayPosPoints={calendar.displayPosPoints}
        displayNegPoints={calendar.displayNegPoints}
        displayNeuPoints={calendar.displayNeuPoints}
        dayHabits={calendar.dayHabits}
        activeMoodConfig={activeMoodConfig}
        rpgHistory={rpgHistory}
        todayStr={todayStr}
        selectedDayMonthGenitive={calendar.selectedDayMonthGenitive}
        handlePrevMonth={calendar.handlePrevMonth}
        handleNextMonth={calendar.handleNextMonth}
        handleDayPress={calendar.handleDayPress}
        styles={styles}
        theme={theme}
        t={t}
      />
    </View>
  );
});

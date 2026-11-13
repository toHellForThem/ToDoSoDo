import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Platform,
  UIManager,
  BackHandler,
  useWindowDimensions,
  Keyboard
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { renderLeftAction } from './src/utils/swipe';
import { getStyles } from './App.styles';
import { getTheme } from './src/theme/theme';
import { ThemeContext } from './src/theme/ThemeContext';
import { TodoTab } from './src/tabs/TodoTab';
import { RecycleTab } from './src/tabs/RecycleTab';
import { DailyTab } from './src/tabs/DailyTab';
import { SettingsTab } from './src/tabs/SettingsTab';
import { RpgTab } from './src/tabs/RpgTab';
import { TabBar } from './src/components/TabBar';
import { Header } from './src/components/Header';
import { LanguageProvider } from './src/utils/LanguageContext';
import { useTodoActions } from './src/hooks/useTodoActions';
import { useTodoSocket } from './src/hooks/useTodoSocket';
import { useMoodSheet } from './src/hooks/useMoodSheet';
import { useShortcuts } from './src/hooks/useShortcuts';
import { AuthStorage, AuthMode, DEFAULT_SHORTCUTS, Todo, UserSettings } from './src/utils/storage';
import { getLogicalDateStr, getLogicalDayIndex } from './src/utils/date';
import { send } from './src/sync';
import { ClientEvent } from './src/contract/events';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_VIEWS = {
  todo: {
    list: (props: any) => (
      <TodoTab
        onAdd={props.onAdd}
        todoList={props.todoList}
        statusChangeTask={props.statusChangeTask}
        deleteTodo={props.handleDeleteTodo}
        leftAction={props.leftAction}
        selectedTaskId={props.selectedTaskId}
        focusInputTrigger={props.focusInputTrigger}
        isActive={props.mainTab === 'todo'}
      />
    ),
  },
  daily: {
    list: (props: any) => (
      <DailyTab
        todoList={props.todoList}
        onAdd={props.onAdd}
        statusChangeTask={props.statusChangeTask}
        deleteTodo={props.handleDeleteTodo}
        leftAction={props.leftAction}
        dailyDays={props.dailyDays}
        setDailyDays={props.setDailyDays}
        dailyProgressEnd={props.dailyProgressEnd}
        setDailyProgressEnd={props.setDailyProgressEnd}
        isWideScreen={props.isWideScreen}
        settings={props.settings}
        selectedTaskId={props.selectedTaskId}
        focusInputTrigger={props.focusInputTrigger}
        isActive={props.mainTab === 'daily'}
      />
    ),
  },
  rpg: {
    list: (props: any) => (
      <RpgTab
        rpgHistory={props.rpgHistory}
        todoList={props.todoList}
        leftAction={props.leftAction}
        deleteToRecycle={props.handleDeleteTodo}
        addTask={props.addTask}
        statusChangeTask={props.statusChangeTask}
        subtab={props.rpgSubtab}
        setSubtab={props.setRpgSubtab}
        isCalendarVisible={props.isCalendarVisible}
        setCalendarVisible={props.setCalendarVisible}
        settings={props.settings}
        showIsMovie={props.showIsMovie}
        setShowIsMovie={props.setShowIsMovie}
        showStartEpisode={props.showStartEpisode}
        setShowStartEpisode={props.setShowStartEpisode}
        isWideScreen={props.isWideScreen}
        focusedGoalId={props.focusedGoalId}
        setFocusedGoalId={props.setFocusedGoalId}
        flashingGoalId={props.flashingGoalId}
        piggyInputs={props.piggyInputs}
        setPiggyInputs={props.setPiggyInputs}
        handleUpdatePiggy={props.handleUpdatePiggy}
        selectedTaskId={props.selectedTaskId}
        focusInputTrigger={props.focusInputTrigger}
        isActive={props.mainTab === 'rpg'}
      />
    ),
  },
};

const GLOBAL_VIEWS = {
  settings: (props: any) => (
    <SettingsTab
      authMode={props.authMode}
      setAuthMode={props.setAuthMode}
      authState={props.authState}
      setAuthState={props.setAuthState}
      settings={props.settings}
      setSettings={props.setSettings}
      setTodoList={props.setTodoList}
      setRpgHistory={props.setRpgHistory}
      setMainTab={props.setMainTab}
      todoList={props.todoList}
      editTask={props.editTask}
      leftAction={props.leftAction}
    />
  ),
  recycle: (props: any) => (
    <RecycleTab
      context={props.mainTab}
      rpgSubtab={props.rpgSubtab}
      todoList={props.todoList}
      deleteTodo={props.deleteTodo}
      leftAction={props.leftAction}
      setTodoList={props.setTodoList}
      selectedTaskId={props.selectedTaskId}
    />
  ),
};

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(() => AuthStorage.getSettings());
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;

  const isDark = settings?.theme === 'dark';
  const theme = useMemo(() => getTheme(settings?.theme), [settings?.theme]);
  const styles = useMemo(() => getStyles(theme), [theme]);

  const moods = useMemo(() => {
    const isMint = settings?.theme === 'mint';
    const isPink = settings?.theme === 'pink';
    if (isDark) {
      return [
        { value: 1, icon: 'emoticon-dead-outline', color: '#94A3B8' },
        { value: 2, icon: 'emoticon-sad-outline', color: '#FB7185' },
        { value: 3, icon: 'emoticon-neutral-outline', color: '#F59E0B' },
        { value: 4, icon: 'emoticon-happy-outline', color: '#34D399' },
        { value: 5, icon: 'emoticon-excited-outline', color: '#C084FC' },
      ];
    } else if (isMint) {
      return [
        { value: 1, icon: 'emoticon-dead-outline', color: '#64748B' },
        { value: 2, icon: 'emoticon-sad-outline', color: '#F43F5E' },
        { value: 3, icon: 'emoticon-neutral-outline', color: '#D98A2F' },
        { value: 4, icon: 'emoticon-happy-outline', color: '#10B981' },
        { value: 5, icon: 'emoticon-excited-outline', color: '#8B5CF6' },
      ];
    } else if (isPink) {
      return [
        { value: 1, icon: 'emoticon-dead-outline', color: '#64748B' },
        { value: 2, icon: 'emoticon-sad-outline', color: '#F43F5E' },
        { value: 3, icon: 'emoticon-neutral-outline', color: '#D98A2F' },
        { value: 4, icon: 'emoticon-happy-outline', color: '#10B981' },
        { value: 5, icon: 'emoticon-excited-outline', color: '#D946EF' },
      ];
    } else {
      return [
        { value: 1, icon: 'emoticon-dead-outline', color: '#64748B' },
        { value: 2, icon: 'emoticon-sad-outline', color: '#F43F5E' },
        { value: 3, icon: 'emoticon-neutral-outline', color: '#D98A2F' },
        { value: 4, icon: 'emoticon-happy-outline', color: '#10B981' },
        { value: 5, icon: 'emoticon-excited-outline', color: '#8B5CF6' },
      ];
    }
  }, [isDark, settings?.theme]);
  const [mainTab, setMainTab] = useState<string>(() => {
    const localSettings = AuthStorage.getSettings();
    return localSettings.main_page || 'todo';
  });
  const [activeView, setActiveView] = useState<'list' | 'recycle' | 'settings'>('list');
  const [authMode, setAuthMode] = useState<AuthMode>('local');
  const [authState, setAuthState] = useState<string>('');
  const [focusedGoalId, setFocusedGoalId] = useState<string | null>(null);
  const [flashingGoalId, setFlashingGoalId] = useState<string | null>(null);
  const [piggyInputs, setPiggyInputs] = useState<Record<string, string>>({});
  const [focusInputTrigger, setFocusInputTrigger] = useState<number>(0);
  const flashTimerRef = useRef<any>(null);

  const [rpgSubtab, setRpgSubtabState] = useState<string>(() => {
    const localSettings = AuthStorage.getSettings();
    const savedSubtab = localSettings.rpg_subtab;
    if (savedSubtab === 'habits' || savedSubtab === 'piggy_bank' || savedSubtab === 'tv_shows') {
      return savedSubtab;
    }
    return 'dashboard';
  });
  const setRpgSubtab = useCallback((val: string) => {
    setRpgSubtabState(val);
    setFocusedGoalId(null);
  }, []);

  const [isCalendarVisible, setCalendarVisible] = useState<boolean>(false);

  const [dailyDays, setDailyDays] = useState<string>('1111111');
  const [dailyProgressEnd, setDailyProgressEnd] = useState<number>(1);
  const [showIsMovie, setShowIsMovie] = useState<boolean>(false);
  const [showStartEpisode, setShowStartEpisode] = useState<string>('1');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const {
    todoList,
    setTodoList,
    addTask,
    deleteToRecycle,
    statusChangeTask,
    deleteTodo,
    rpgHistory,
    setRpgHistory,
    handleMoodChange,
    editTask,
    resetHistorySync,
  } = useTodoActions(mainTab, settings, authMode);

  const handleDeleteTodo = useCallback((id: string) => {
    if (settings.soft_delete) {
      deleteToRecycle(id);
    } else {
      deleteTodo(id);
    }
  }, [settings.soft_delete, deleteToRecycle, deleteTodo]);

  const handleUpdatePiggy = useCallback((goalId: string, inputVal: number, isAdd: boolean) => {
    statusChangeTask(goalId, isAdd ? inputVal : -inputVal);
    Keyboard.dismiss();

    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    setFlashingGoalId(goalId);
    flashTimerRef.current = setTimeout(() => {
      setFlashingGoalId(null);
      flashTimerRef.current = null;
    }, 650);
  }, [statusChangeTask]);

  useTodoSocket({
    setTodoList,
    setAuthMode,
    setAuthState,
    setRpgHistory,
    setSettings,
    settings,
    setMainTab,
    onSessionCleared: resetHistorySync
  });

  const [isMoodSheetOpen, setIsMoodSheetOpen] = useState(false);
  const moodSheet = useMoodSheet(setIsMoodSheetOpen);

  const handleTabChange = useCallback((tab: string) => {
    if (tab === 'rpg') {
      setRpgSubtab('dashboard');
    }
    setMainTab(tab);
    setActiveView('list');
    setFocusedGoalId(null);
    setSelectedTaskId(null);
  }, [setRpgSubtab]);

  const handleSubtabChange = useCallback((subtab: string) => {
    setMainTab('rpg');
    setRpgSubtab(subtab);
    setActiveView('list');
    setSelectedTaskId(null);
  }, [setRpgSubtab]);

  const habdleActiveView = useCallback((view: 'list' | 'recycle' | 'settings') => {
    if (activeView === view) {
      setActiveView('list');
    } else {
      setActiveView(view);
    }
    setSelectedTaskId(null);
  }, [activeView]);

  const handleMoodSheet = useCallback(() => {
    if (moodSheet.isActive && moodSheet.isActive.value === 1) {
      moodSheet.closeSheet();
    } else {
      moodSheet.openSheet();
    }
  }, [moodSheet]);

  const handleOpenCalendar = useCallback(() => {
    if (isCalendarVisible) {
      setCalendarVisible(false);
    } else {
      setCalendarVisible(true);
    }
    setMainTab('rpg');
    setRpgSubtab('dashboard');
    setActiveView('list');
    setSelectedTaskId(null);
  }, [isCalendarVisible, setRpgSubtab]);

  const handleBackAction = useCallback(() => {
    if (moodSheet.isActive && moodSheet.isActive.value === 1) {
      moodSheet.closeSheet();
      return true;
    }

    if (isCalendarVisible) {
      setCalendarVisible(false);
      return true;
    }

    if (activeView !== 'list') {
      setActiveView('list');
      return true;
    }

    if (mainTab === 'rpg' && rpgSubtab !== 'dashboard') {
      setRpgSubtab('dashboard');
      return true;
    }

    return false;
  }, [moodSheet, isCalendarVisible, activeView, mainTab, rpgSubtab, setRpgSubtab]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackAction
    );

    return () => backHandler.remove();
  }, [handleBackAction]);

  const handleLeftAction = useCallback((prog: any, drag: any, mode: string) => {
    return renderLeftAction(prog, drag, mode, theme, settings?.language || 'ru', settings?.soft_delete !== false);
  }, [theme, settings?.language, settings?.soft_delete]);

  const tabProps = useMemo(() => ({
    onAdd: addTask,
    todoList,
    setTodoList,
    statusChangeTask,
    deleteToRecycle: handleDeleteTodo,
    handleDeleteTodo,
    leftAction: handleLeftAction,
    rpgHistory,
    setRpgHistory,
    addTask,
    rpgSubtab,
    setRpgSubtab,
    isCalendarVisible,
    setCalendarVisible,
    settings,
    dailyDays,
    setDailyDays,
    dailyProgressEnd,
    setDailyProgressEnd,
    showIsMovie,
    setShowIsMovie,
    showStartEpisode,
    setShowStartEpisode,
    isWideScreen,
    focusedGoalId,
    setFocusedGoalId,
    flashingGoalId,
    piggyInputs,
    setPiggyInputs,
    handleUpdatePiggy,
    selectedTaskId,
    focusInputTrigger,
    mainTab,
  }), [addTask, todoList, setTodoList, statusChangeTask, handleDeleteTodo, handleLeftAction, rpgHistory, setRpgHistory, rpgSubtab, setRpgSubtab, isCalendarVisible, setCalendarVisible, settings, dailyDays, setDailyDays, dailyProgressEnd, setDailyProgressEnd, showIsMovie, setShowIsMovie, showStartEpisode, setShowStartEpisode, isWideScreen, focusedGoalId, setFocusedGoalId, flashingGoalId, piggyInputs, setPiggyInputs, handleUpdatePiggy, selectedTaskId, focusInputTrigger, mainTab]);

  const getActiveItems = useCallback(() => {
    if (activeView !== 'list' && activeView !== 'recycle') return [];
    const isRecycle = activeView === 'recycle';

    if (mainTab === 'todo') {
      return todoList
        .filter(item => item.type === 'todo' && (isRecycle ? item.deleted : !item.deleted))
        .sort((a, b) => {
          if (a.completed && !b.completed) return 1;
          if (!a.completed && b.completed) return -1;
          return 0;
        });
    }
    if (mainTab === 'daily') {
      const todayDayIdx = getLogicalDayIndex(
        getLogicalDateStr(settings?.reset_time, settings?.timezone)
      );
      return todoList
        .filter(item => {
          if (item.type !== 'daily' || (isRecycle ? !item.deleted : item.deleted)) return false;
          const daysStr = item.days || '1111111';
          return daysStr[todayDayIdx] === '1';
        })
        .sort((a, b) => {
          if (a.completed && !b.completed) return 1;
          if (!a.completed && b.completed) return -1;
          return 0;
        });
    }
    if (mainTab === 'rpg') {
      if (rpgSubtab === 'habits') {
        return todoList.filter(item => item.type === 'habit' && (isRecycle ? item.deleted : !item.deleted));
      }
      if (rpgSubtab === 'piggy_bank') {
        return todoList.filter(item => item.type === 'piggy_bank' && (isRecycle ? item.deleted : !item.deleted));
      }
      if (rpgSubtab === 'tv_shows') {
        return todoList.filter(item => (item.type === 'tv_show' || item.type === 'movie') && (isRecycle ? item.deleted : !item.deleted));
      }
    }
    return [];
  }, [
    mainTab,
    rpgSubtab,
    activeView,
    todoList,
    settings?.reset_time,
    settings?.timezone,
  ]);

  const shortcuts = settings?.shortcuts || DEFAULT_SHORTCUTS;

  const shortcutsMap = useMemo(() => {
    const map: Record<string, (e?: any) => void> = {};
    if (shortcuts.rpg_tab) map[shortcuts.rpg_tab] = () => handleTabChange('rpg');
    if (shortcuts.todo_tab) map[shortcuts.todo_tab] = () => handleTabChange('todo');
    if (shortcuts.daily_tab) map[shortcuts.daily_tab] = () => handleTabChange('daily');
    if (shortcuts.habits_subtab) map[shortcuts.habits_subtab] = () => handleSubtabChange('habits');
    if (shortcuts.piggy_subtab) map[shortcuts.piggy_subtab] = () => handleSubtabChange('piggy_bank');
    if (shortcuts.tv_subtab) map[shortcuts.tv_subtab] = () => handleSubtabChange('tv_shows');
    if (shortcuts.recycle_view) map[shortcuts.recycle_view] = () => habdleActiveView('recycle');
    if (shortcuts.settings_view) map[shortcuts.settings_view] = () => habdleActiveView('settings');
    if (shortcuts.calendar_view) map[shortcuts.calendar_view] = () => handleOpenCalendar();
    if (shortcuts.mood_view) map[shortcuts.mood_view] = () => handleMoodSheet();

    map['escape'] = () => {
      handleBackAction();
    };

    if (isMoodSheetOpen) {
      map['1'] = () => { handleMoodChange(1); moodSheet.closeSheet(); };
      map['2'] = () => { handleMoodChange(2); moodSheet.closeSheet(); };
      map['3'] = () => { handleMoodChange(3); moodSheet.closeSheet(); };
      map['4'] = () => { handleMoodChange(4); moodSheet.closeSheet(); };
      map['5'] = () => { handleMoodChange(5); moodSheet.closeSheet(); };
    }

    map['arrowdown'] = (e: any) => {
      if (isCalendarVisible) return;
      e.preventDefault();
      const items = getActiveItems();
      if (items.length === 0) return;
      const currentIndex = items.findIndex(item => item.id === selectedTaskId);
      if (currentIndex === -1) {
        setSelectedTaskId(items[0].id);
      } else if (currentIndex === items.length - 1) {
        setSelectedTaskId(items[0].id);
      } else {
        setSelectedTaskId(items[currentIndex + 1].id);
      }
    };

    map['arrowup'] = (e: any) => {
      if (isCalendarVisible) return;
      e.preventDefault();
      const items = getActiveItems();
      if (items.length === 0) return;
      const currentIndex = items.findIndex(item => item.id === selectedTaskId);
      if (currentIndex === -1) {
        setSelectedTaskId(items[items.length - 1].id);
      } else if (currentIndex === 0) {
        setSelectedTaskId(items[items.length - 1].id);
      } else {
        setSelectedTaskId(items[currentIndex - 1].id);
      }
    };

    const handleToggleSelected = (e: any) => {
      if (isCalendarVisible) return;
      if (!selectedTaskId) return;
      const items = getActiveItems();
      const selectedItem = items.find(item => item.id === selectedTaskId);
      if (!selectedItem) return;
      e.preventDefault();

      if (activeView === 'recycle') {
        const index = items.findIndex(item => item.id === selectedTaskId);
        let nextSelectedId = null;
        if (items.length > 1) {
          if (index === items.length - 1) {
            nextSelectedId = items[index - 1].id;
          } else {
            nextSelectedId = items[index + 1].id;
          }
        }
        let updated = null;
        setTodoList(prev => {
          return prev.map(todo => {
            if (todo.id === selectedTaskId) {
              updated = { ...todo, deleted: false, updatedAt: Date.now() };
              return updated;
            }
            return todo;
          });
        });
        if (updated) {
          send(ClientEvent.SYNC_TODO, updated);
        }
        setSelectedTaskId(nextSelectedId);
        return;
      }

      if (selectedItem.type === 'todo') {
        statusChangeTask(selectedTaskId, 1);
      } else if (selectedItem.type === 'daily') {
        statusChangeTask(selectedTaskId);
      } else if (selectedItem.type === 'habit') {
        statusChangeTask(selectedTaskId);
      } else if (selectedItem.type === 'tv_show') {
        statusChangeTask(selectedTaskId, 1, 'episode');
      } else if (selectedItem.type === 'movie') {
        statusChangeTask(selectedTaskId);
      } else if (selectedItem.type === 'piggy_bank') {
        statusChangeTask(selectedTaskId, 1);
      }
    };
    map['enter'] = handleToggleSelected;
    map['space'] = handleToggleSelected;

    map['arrowright'] = (e: any) => {
      if (isCalendarVisible) return;
      if (!selectedTaskId) return;
      const items = getActiveItems();
      const index = items.findIndex(item => item.id === selectedTaskId);
      if (index !== -1) {
        e.preventDefault();
        let nextSelectedId = null;
        if (items.length > 1) {
          if (index === items.length - 1) {
            nextSelectedId = items[index - 1].id;
          } else {
            nextSelectedId = items[index + 1].id;
          }
        }
        if (activeView === 'recycle') {
          deleteTodo(selectedTaskId);
        } else {
          handleDeleteTodo(selectedTaskId);
        }
        setSelectedTaskId(nextSelectedId);
      }
    };

    map['backspace'] = (e: any) => {
      if (isCalendarVisible) return;
      if (!selectedTaskId) return;
      const items = getActiveItems();
      const selectedItem = items.find(item => item.id === selectedTaskId);
      if (!selectedItem) return;
      if (selectedItem.type === 'habit') {
        e.preventDefault();
        statusChangeTask(selectedTaskId, 'reset');
      } else if (selectedItem.type === 'piggy_bank') {
        e.preventDefault();
        statusChangeTask(selectedTaskId, -1);
      } else if (selectedItem.type === 'tv_show') {
        e.preventDefault();
        statusChangeTask(selectedTaskId, -1, 'episode');
      }
    };

    map['i'] = (e: any) => {
      if (isCalendarVisible) return;
      e.preventDefault();
      setFocusInputTrigger(prev => prev + 1);
    };

    return map;
  }, [
    shortcuts,
    isMoodSheetOpen,
    selectedTaskId,
    piggyInputs,
    mainTab,
    rpgSubtab,
    getActiveItems,
    handleTabChange,
    handleSubtabChange,
    habdleActiveView,
    handleOpenCalendar,
    handleMoodSheet,
    handleBackAction,
    handleMoodChange,
    moodSheet,
    statusChangeTask,
    handleUpdatePiggy,
    handleDeleteTodo,
    deleteTodo,
    setTodoList,
    setFocusInputTrigger,
    isCalendarVisible,
    activeView
  ]);

  useShortcuts(shortcutsMap);

  const themeContextValue = useMemo(() => ({ theme, isDark }), [theme, isDark]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <LanguageProvider language={settings?.language || 'ru'}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container}>
              {Platform.OS === 'web' && (
                <style dangerouslySetInnerHTML={{
                  __html: `
                  body, html, * {
                    user-select: none !important;
                    -webkit-user-select: none !important;
                    -moz-user-select: none !important;
                    -ms-user-select: none !important;
                    outline: none !important;
                  }
                  *::-webkit-scrollbar {
                    display: none !important;
                  }
                  * {
                    -ms-overflow-style: none !important;
                    scrollbar-width: none !important;
                  }
                  input, textarea, [contenteditable="true"] {
                    user-select: text !important;
                    -webkit-user-select: text !important;
                    -moz-user-select: text !important;
                    -ms-user-select: text !important;
                  }
                `}} />
              )}
              <Header
                {...moodSheet}
                isMoodSheetOpen={isMoodSheetOpen}
                moods={moods}
                activeView={activeView}
                setActiveView={setActiveView}
                setAuthState={setAuthState}
                setAuthMode={setAuthMode}
                authMode={authMode}
                onMoodChange={handleMoodChange}
                rpgHistory={rpgHistory}
                settings={settings}
                isWideScreen={isWideScreen}
                dailyDays={dailyDays}
                setDailyDays={setDailyDays}
                dailyProgressEnd={dailyProgressEnd}
                setDailyProgressEnd={setDailyProgressEnd}
                showIsMovie={showIsMovie}
                setShowIsMovie={setShowIsMovie}
                showStartEpisode={showStartEpisode}
                setShowStartEpisode={setShowStartEpisode}
                rpgSubtab={rpgSubtab}
                mainTab={mainTab}
                focusedGoalId={focusedGoalId}
                piggyInputs={piggyInputs}
                setPiggyInputs={setPiggyInputs}
                handleUpdatePiggy={handleUpdatePiggy}
              />
              <View style={styles.main} pointerEvents={isMoodSheetOpen ? 'none' : 'auto'}>
                {activeView !== 'list' && GLOBAL_VIEWS[activeView] && !(activeView === 'recycle' && isWideScreen) ? (
                  GLOBAL_VIEWS[activeView]({
                    mainTab,
                    rpgSubtab,
                    todoList,
                    deleteTodo,
                    leftAction: handleLeftAction,
                    setTodoList,
                    authMode,
                    setAuthMode,
                    authState,
                    setAuthState,
                    settings,
                    setSettings,
                    setRpgHistory,
                    setMainTab,
                    editTask,
                    selectedTaskId,
                  })
                ) : (
                  isWideScreen ? (
                    <View style={styles.dashboardContainer}>
                      <View
                        onStartShouldSetResponderCapture={() => { if (mainTab !== 'rpg') handleTabChange('rpg'); return false; }}
                        style={[styles.column, mainTab === 'rpg' && styles.activeColumn]}
                      >
                        <View style={styles.columnHeader}>
                          <Text style={styles.columnTitle}>
                            {settings?.language === 'ru' ? '⚔️ РПГ-режим' : '⚔️ RPG Mode'}
                          </Text>
                        </View>
                        <View style={styles.columnContent}>
                          {mainTab === 'rpg' && activeView === 'recycle' ? (
                            <RecycleTab
                              context="rpg"
                              rpgSubtab={rpgSubtab}
                              todoList={todoList}
                              deleteTodo={deleteTodo}
                              leftAction={handleLeftAction}
                              setTodoList={setTodoList}
                              selectedTaskId={selectedTaskId}
                            />
                          ) : (
                            TAB_VIEWS.rpg.list(tabProps)
                          )}
                        </View>
                      </View>
                      <View
                        onStartShouldSetResponderCapture={() => { if (mainTab !== 'todo') handleTabChange('todo'); return false; }}
                        style={[styles.column, mainTab === 'todo' && styles.activeColumn]}
                      >
                        <View style={styles.columnHeader}>
                          <Text style={styles.columnTitle}>
                            {settings?.language === 'ru' ? '📝 Список дел' : '📝 To-Do List'}
                          </Text>
                        </View>
                        <View style={styles.columnContent}>
                          {mainTab === 'todo' && activeView === 'recycle' ? (
                            <RecycleTab
                              context="todo"
                              rpgSubtab={rpgSubtab}
                              todoList={todoList}
                              deleteTodo={deleteTodo}
                              leftAction={handleLeftAction}
                              setTodoList={setTodoList}
                              selectedTaskId={selectedTaskId}
                            />
                          ) : (
                            TAB_VIEWS.todo.list(tabProps)
                          )}
                        </View>
                      </View>
                      <View
                        onStartShouldSetResponderCapture={() => { if (mainTab !== 'daily') handleTabChange('daily'); return false; }}
                        style={[styles.column, mainTab === 'daily' && styles.activeColumn]}
                      >
                        <View style={styles.columnHeader}>
                          <Text style={styles.columnTitle}>
                            {settings?.language === 'ru' ? '⚡ Ежедневные' : '⚡ Daily Tasks'}
                          </Text>
                        </View>
                        <View style={styles.columnContent}>
                          {mainTab === 'daily' && activeView === 'recycle' ? (
                            <RecycleTab
                              context="daily"
                              rpgSubtab={rpgSubtab}
                              todoList={todoList}
                              deleteTodo={deleteTodo}
                              leftAction={handleLeftAction}
                              setTodoList={setTodoList}
                              selectedTaskId={selectedTaskId}
                            />
                          ) : (
                            TAB_VIEWS.daily.list(tabProps)
                          )}
                        </View>
                      </View>
                    </View>
                  ) : (
                    TAB_VIEWS[mainTab as keyof typeof TAB_VIEWS] ? (
                      TAB_VIEWS[mainTab as keyof typeof TAB_VIEWS].list(tabProps)
                    ) : null
                  )
                )}
              </View>
              <TabBar
                currentTab={mainTab}
                setCurrentTab={handleTabChange}
                rpgSubtab={rpgSubtab}
                activeView={activeView}
              />
              <Toast topOffset={120} />
            </SafeAreaView>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </LanguageProvider>
    </ThemeContext.Provider>
  );
}
import { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Platform,
  UIManager,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import {
  ShortcutProvider,
  useCommandRegistry,
  useCommands,
  useScope,
} from './src/commands';
import type { Command } from './src/commands';
import { useAppStore } from './src/store/appStore';
import { selectActiveItems } from './src/store/selectors';
import { DEFAULT_SHORTCUTS } from './src/utils/storage';
import { send } from './src/sync';
import { ClientEvent } from './src/contract/events';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const useMoods = () => {
  const themeName = useAppStore(state => state.settings?.theme);
  return useMemo(() => {
    const isDark = themeName === 'dark';
    const isMint = themeName === 'mint';
    const isPink = themeName === 'pink';
    if (isDark) {
      return [
        { value: 1, icon: 'emoticon-dead-outline', color: '#94A3B8' },
        { value: 2, icon: 'emoticon-sad-outline', color: '#FB7185' },
        { value: 3, icon: 'emoticon-neutral-outline', color: '#F59E0B' },
        { value: 4, icon: 'emoticon-happy-outline', color: '#34D399' },
        { value: 5, icon: 'emoticon-excited-outline', color: '#C084FC' },
      ];
    }
    if (isMint) {
      return [
        { value: 1, icon: 'emoticon-dead-outline', color: '#64748B' },
        { value: 2, icon: 'emoticon-sad-outline', color: '#F43F5E' },
        { value: 3, icon: 'emoticon-neutral-outline', color: '#D98A2F' },
        { value: 4, icon: 'emoticon-happy-outline', color: '#10B981' },
        { value: 5, icon: 'emoticon-excited-outline', color: '#8B5CF6' },
      ];
    }
    if (isPink) {
      return [
        { value: 1, icon: 'emoticon-dead-outline', color: '#64748B' },
        { value: 2, icon: 'emoticon-sad-outline', color: '#F43F5E' },
        { value: 3, icon: 'emoticon-neutral-outline', color: '#D98A2F' },
        { value: 4, icon: 'emoticon-happy-outline', color: '#10B981' },
        { value: 5, icon: 'emoticon-excited-outline', color: '#D946EF' },
      ];
    }
    return [
      { value: 1, icon: 'emoticon-dead-outline', color: '#64748B' },
      { value: 2, icon: 'emoticon-sad-outline', color: '#F43F5E' },
      { value: 3, icon: 'emoticon-neutral-outline', color: '#D98A2F' },
      { value: 4, icon: 'emoticon-happy-outline', color: '#10B981' },
      { value: 5, icon: 'emoticon-excited-outline', color: '#8B5CF6' },
    ];
  }, [themeName]);
};

function AppContent() {
  const registry = useCommandRegistry();
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;

  const settings = useAppStore(state => state.settings);
  const mainTab = useAppStore(state => state.mainTab);
  const rpgSubtab = useAppStore(state => state.rpgSubtab);
  const activeView = useAppStore(state => state.activeView);
  const isCalendarVisible = useAppStore(state => state.isCalendarVisible);
  const isMoodSheetOpen = useAppStore(state => state.isMoodSheetOpen);
  const selectedTaskId = useAppStore(state => state.selectedTaskId);

  const setRpgSubtab = useAppStore(state => state.setRpgSubtab);
  const setActiveView = useAppStore(state => state.setActiveView);
  const setCalendarVisible = useAppStore(state => state.setCalendarVisible);
  const setSelectedTaskId = useAppStore(state => state.setSelectedTaskId);
  const setIsMoodSheetOpen = useAppStore(state => state.setIsMoodSheetOpen);
  const handleTabChange = useAppStore(state => state.handleTabChange);
  const handleSubtabChange = useAppStore(state => state.handleSubtabChange);
  const toggleActiveView = useAppStore(state => state.toggleActiveView);
  const toggleCalendar = useAppStore(state => state.toggleCalendar);
  const handleMoodChange = useAppStore(state => state.handleMoodChange);
  const statusChangeTask = useAppStore(state => state.statusChangeTask);
  const deleteTodo = useAppStore(state => state.deleteTodo);
  const handleDeleteTodo = useAppStore(state => state.handleDeleteTodo);
  const setTodoList = useAppStore(state => state.setTodoList);

  const isDark = settings?.theme === 'dark';
  const theme = useMemo(() => getTheme(settings?.theme), [settings?.theme]);
  const styles = useMemo(() => getStyles(theme), [theme]);
  const moods = useMoods();

  const { resetHistorySync } = useTodoActions();
  useTodoSocket({ onSessionCleared: resetHistorySync });

  const moodSheet = useMoodSheet(setIsMoodSheetOpen);

  const handleMoodSheet = useCallback(() => {
    if (moodSheet.isActive && moodSheet.isActive.value === 1) {
      moodSheet.closeSheet();
    } else {
      moodSheet.openSheet();
    }
  }, [moodSheet.isActive, moodSheet.closeSheet, moodSheet.openSheet]);

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
  }, [
    moodSheet.isActive,
    moodSheet.closeSheet,
    isCalendarVisible,
    activeView,
    mainTab,
    rpgSubtab,
    setCalendarVisible,
    setActiveView,
    setRpgSubtab,
  ]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackAction
    );

    return () => backHandler.remove();
  }, [handleBackAction]);

  const shortcuts = settings?.shortcuts || DEFAULT_SHORTCUTS;

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    const add = (
      id: string,
      title: string,
      shortcut: string | undefined,
      scope: Command['scope'],
      run: Command['run'],
      when?: Command['when']
    ) => {
      if (!shortcut) return;
      list.push({ id, title, shortcut, scope, run, when });
    };

    add('tab.rpg', 'RPG tab', shortcuts?.rpg_tab, 'global', () => handleTabChange('rpg'));
    add('tab.todo', 'To-do tab', shortcuts?.todo_tab, 'global', () => handleTabChange('todo'));
    add('tab.daily', 'Daily tab', shortcuts?.daily_tab, 'global', () => handleTabChange('daily'));
    add('subtab.habits', 'Habits subtab', shortcuts?.habits_subtab, 'global', () => handleSubtabChange('habits'));
    add('subtab.piggy', 'Piggy bank subtab', shortcuts?.piggy_subtab, 'global', () => handleSubtabChange('piggy_bank'));
    add('subtab.tv', 'TV shows subtab', shortcuts?.tv_subtab, 'global', () => handleSubtabChange('tv_shows'));
    add('view.recycle', 'Recycle view', shortcuts?.recycle_view, 'global', () => toggleActiveView('recycle'));
    add('view.settings', 'Settings view', shortcuts?.settings_view, 'global', () => toggleActiveView('settings'));
    add('view.calendar', 'Calendar view', shortcuts?.calendar_view, 'global', () => toggleCalendar());
    add('view.mood', 'Mood view', shortcuts?.mood_view, 'global', () => handleMoodSheet());

    add('nav.back', 'Back', 'escape', 'global', () => handleBackAction());

    if (isMoodSheetOpen) {
      add('mood.1', 'Mood 1', '1', 'modal', () => { handleMoodChange(1); moodSheet.closeSheet(); });
      add('mood.2', 'Mood 2', '2', 'modal', () => { handleMoodChange(2); moodSheet.closeSheet(); });
      add('mood.3', 'Mood 3', '3', 'modal', () => { handleMoodChange(3); moodSheet.closeSheet(); });
      add('mood.4', 'Mood 4', '4', 'modal', () => { handleMoodChange(4); moodSheet.closeSheet(); });
      add('mood.5', 'Mood 5', '5', 'modal', () => { handleMoodChange(5); moodSheet.closeSheet(); });
    }

    const getActiveItems = () => selectActiveItems(useAppStore.getState());
    const listScope = mainTab;

    add('list.next', 'Next item', 'arrowdown', listScope, () => {
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
    });

    add('list.prev', 'Previous item', 'arrowup', listScope, () => {
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
    });

    const handleToggleSelected = () => {
      if (!selectedTaskId) return;
      const items = getActiveItems();
      const selectedItem = items.find(item => item.id === selectedTaskId);
      if (!selectedItem) return;

      if (activeView === 'recycle') {
        const index = items.findIndex(item => item.id === selectedTaskId);
        let nextSelectedId: string | null = null;
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
    add('list.toggle', 'Toggle item', 'enter', listScope, handleToggleSelected);
    add('list.toggle.space', 'Toggle item', 'space', listScope, handleToggleSelected);

    add('list.delete', 'Delete item', 'arrowright', listScope, () => {
      if (!selectedTaskId) return;
      const items = getActiveItems();
      const index = items.findIndex(item => item.id === selectedTaskId);
      if (index === -1) return;

      let nextSelectedId: string | null = null;
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
    });

    add('list.decrement', 'Decrement item', 'backspace', listScope, () => {
      if (!selectedTaskId) return;
      const items = getActiveItems();
      const selectedItem = items.find(item => item.id === selectedTaskId);
      if (!selectedItem) return;
      if (selectedItem.type === 'habit') {
        statusChangeTask(selectedTaskId, 'reset');
      } else if (selectedItem.type === 'piggy_bank') {
        statusChangeTask(selectedTaskId, -1);
      } else if (selectedItem.type === 'tv_show') {
        statusChangeTask(selectedTaskId, -1, 'episode');
      }
    });

    add('focus.activeInput', 'Focus active input', 'i', 'global', () => {
      registry.focusActiveInput();
    });

    return list;
  }, [
    shortcuts,
    isMoodSheetOpen,
    selectedTaskId,
    mainTab,
    handleTabChange,
    handleSubtabChange,
    toggleActiveView,
    toggleCalendar,
    handleMoodSheet,
    handleBackAction,
    handleMoodChange,
    moodSheet.closeSheet,
    statusChangeTask,
    handleDeleteTodo,
    deleteTodo,
    setTodoList,
    setSelectedTaskId,
    activeView,
    registry,
  ]);

  useCommands(commands);
  useScope(mainTab);
  useScope('modal', isMoodSheetOpen);

  const themeContextValue = useMemo(() => ({ theme, isDark }), [theme, isDark]);

  const renderTab = (tab: 'todo' | 'daily' | 'rpg') => {
    if (tab === 'todo') return <TodoTab />;
    if (tab === 'daily') return <DailyTab />;
    return <RpgTab />;
  };

  const renderColumn = (tab: 'todo' | 'daily' | 'rpg', title: string) => (
    <View
      onStartShouldSetResponderCapture={() => {
        if (mainTab !== tab) handleTabChange(tab);
        return false;
      }}
      style={[styles.column, mainTab === tab && styles.activeColumn]}
    >
      <View style={styles.columnHeader}>
        <Text style={styles.columnTitle}>{title}</Text>
      </View>
      <View style={styles.columnContent}>
        {mainTab === tab && activeView === 'recycle' ? (
          <RecycleTab context={tab} />
        ) : (
          renderTab(tab)
        )}
      </View>
    </View>
  );

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
                moods={moods}
                isMoodSheetOpen={isMoodSheetOpen}
                isWideScreen={isWideScreen}
              />
              <View style={styles.main} pointerEvents={isMoodSheetOpen ? 'none' : 'auto'}>
                {activeView !== 'list' && !(activeView === 'recycle' && isWideScreen) ? (
                  activeView === 'settings' ? (
                    <SettingsTab />
                  ) : (
                    <RecycleTab context={mainTab} />
                  )
                ) : isWideScreen ? (
                  <View style={styles.dashboardContainer}>
                    {renderColumn(
                      'rpg',
                      settings?.language === 'ru' ? '⚔️ РПГ-режим' : '⚔️ RPG Mode'
                    )}
                    {renderColumn(
                      'todo',
                      settings?.language === 'ru' ? '📝 Список дел' : '📝 To-Do List'
                    )}
                    {renderColumn(
                      'daily',
                      settings?.language === 'ru' ? '⚡ Ежедневные' : '⚡ Daily Tasks'
                    )}
                  </View>
                ) : (
                  renderTab(mainTab)
                )}
              </View>
              <TabBar />
              <Toast topOffset={120} />
            </SafeAreaView>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </LanguageProvider>
    </ThemeContext.Provider>
  );
}

export default function App() {
  return (
    <ShortcutProvider>
      <AppContent />
    </ShortcutProvider>
  );
}

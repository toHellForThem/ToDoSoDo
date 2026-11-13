import { useCallback, useEffect } from 'react';
import { View, BackHandler, useWindowDimensions } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getStyles } from '../../App.styles';
import { useStyles } from '../theme/ThemeContext';
import { Header } from '../components/Header';
import { TabBar } from '../components/TabBar';
import { useTodoActions } from '../hooks/useTodoActions';
import { useTodoSocket } from '../hooks/useTodoSocket';
import { useMoodSheet } from '../hooks/useMoodSheet';
import { useMoods } from '../hooks/useMoods';
import { useBackAction } from '../hooks/useBackAction';
import { useAppCommands } from '../hooks/useAppCommands';
import { useCommandRegistry, useCommands, useScope } from '../commands';
import { useAppStore } from '../store/appStore';
import { DEFAULT_SHORTCUTS } from '../utils/storage';
import { Navigation } from './Navigation';

/** Каркас приложения: шапка, контент, таб-бар и глобальные команды. */
export const AppShell = () => {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;

  const settings = useAppStore(state => state.settings);
  const mainTab = useAppStore(state => state.mainTab);
  const isMoodSheetOpen = useAppStore(state => state.isMoodSheetOpen);
  const setIsMoodSheetOpen = useAppStore(state => state.setIsMoodSheetOpen);

  const styles = useStyles(getStyles);
  const moods = useMoods();
  const registry = useCommandRegistry();

  const { resetHistorySync } = useTodoActions();
  useTodoSocket({ onSessionCleared: resetHistorySync });

  const moodSheet = useMoodSheet(setIsMoodSheetOpen);

  const handleMoodSheet = useCallback(() => {
    if (moodSheet.isActive.value === 1) {
      moodSheet.closeSheet();
    } else {
      moodSheet.openSheet();
    }
  }, [moodSheet.isActive, moodSheet.closeSheet, moodSheet.openSheet]);

  const isMoodSheetActive = useCallback(
    () => moodSheet.isActive.value === 1,
    [moodSheet.isActive]
  );

  const handleBackAction = useBackAction({
    isMoodSheetActive,
    closeMoodSheet: moodSheet.closeSheet,
  });

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackAction
    );

    return () => backHandler.remove();
  }, [handleBackAction]);

  const shortcuts = settings?.shortcuts || DEFAULT_SHORTCUTS;

  const focusActiveInput = useCallback(
    () => registry.focusActiveInput(),
    [registry]
  );

  const commands = useAppCommands({
    shortcuts,
    isMoodSheetOpen,
    closeMoodSheet: moodSheet.closeSheet,
    handleMoodSheet,
    handleBackAction,
    focusActiveInput,
  });

  useCommands(commands);
  useScope(mainTab);
  useScope('modal', isMoodSheetOpen);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        {...moodSheet}
        moods={moods}
        isMoodSheetOpen={isMoodSheetOpen}
        isWideScreen={isWideScreen}
      />
      <View style={styles.main} pointerEvents={isMoodSheetOpen ? 'none' : 'auto'}>
        <Navigation isWideScreen={isWideScreen} />
      </View>
      <TabBar />
      <Toast topOffset={120} />
    </SafeAreaView>
  );
};

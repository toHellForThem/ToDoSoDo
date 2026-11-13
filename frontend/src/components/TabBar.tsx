import { memo, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import { getStyles } from './TabBar.styles';
import { useAppTheme, useStyles } from '../theme/ThemeContext';
import { useTranslation } from '../utils/LanguageContext';
import { useAppStore } from '../store/appStore';

export const TabBar = memo(function TabBar() {
  const currentTab = useAppStore(state => state.mainTab);
  const setCurrentTab = useAppStore(state => state.handleTabChange);
  const rpgSubtab = useAppStore(state => state.rpgSubtab);
  const activeView = useAppStore(state => state.activeView);
  const styles = useStyles(getStyles);
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const isRpgActive = currentTab === 'rpg';
  const isTodoActive = currentTab === 'todo';
  const isDailyActive = currentTab === 'daily';

  const shouldBlink = (isRpgActive && rpgSubtab !== 'dashboard') || activeView === 'recycle' || activeView === 'settings';

  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (shouldBlink) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      blinkAnim.setValue(1);
    }
  }, [shouldBlink, blinkAnim]);

  const renderActiveIndicator = (isActive: boolean) => {
    if (!isActive) return null;
    return (
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: theme.colors.primary,
          opacity: shouldBlink ? blinkAnim : 1,
        }}
      />
    );
  };

  return (
    <View style={styles.footer}>
      <TouchableOpacity
        style={[
          styles.tab,
          isRpgActive && styles.activeTab,
          isRpgActive && { borderTopWidth: 0 }
        ]}
        onPress={() => setCurrentTab('rpg')}
      >
        {renderActiveIndicator(isRpgActive)}
        <Text style={[styles.tabText, { color: isRpgActive ? theme.colors.primary : theme.colors.text.secondary }]}>{t('tab_rpg')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tab,
          isTodoActive && styles.activeTab,
          isTodoActive && { borderTopWidth: 0 }
        ]}
        onPress={() => setCurrentTab('todo')}
      >
        {renderActiveIndicator(isTodoActive)}
        <Text style={[styles.tabText, { color: isTodoActive ? theme.colors.primary : theme.colors.text.secondary }]}>{t('tab_todo')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tab,
          isDailyActive && styles.activeTab,
          isDailyActive && { borderTopWidth: 0 }
        ]}
        onPress={() => setCurrentTab('daily')}
      >
        {renderActiveIndicator(isDailyActive)}
        <Text style={[styles.tabText, { color: isDailyActive ? theme.colors.primary : theme.colors.text.secondary }]}>{t('tab_daily')}</Text>
      </TouchableOpacity>
    </View>
  );
});

import { memo, Dispatch, SetStateAction } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleProp,
  ViewStyle
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { GestureDetector } from 'react-native-gesture-handler';
import ReAnimated from 'react-native-reanimated';
import { getStyles } from './Header.styles';
import { useAppTheme, useStyles } from '../theme/ThemeContext';
import { getLogicalDateStr } from '../utils/date';
import { useTranslation } from '../utils/LanguageContext';
import { AuthMode, RpgHistoryItem, UserSettings } from '../utils/storage';


export type ActiveViewType = 'list' | 'recycle' | 'settings';

interface MoodItem {
  value: number;
  icon: string;
  color: string;
}

interface HeaderProps {
  panGesture: any;
  moods: MoodItem[];
  tailStyle: StyleProp<ViewStyle>;
  animatedStyle: StyleProp<ViewStyle>;
  contentAnimatedStyle: StyleProp<ViewStyle>;
  activeView: ActiveViewType;
  setActiveView: Dispatch<SetStateAction<ActiveViewType>>;
  setAuthState: (state: string) => void;
  setAuthMode: (mode: AuthMode) => void;
  authMode: AuthMode;
  onMoodChange: (mood: number) => void;
  rpgHistory: RpgHistoryItem[];
  settings: UserSettings;
  closeSheet: () => void;
  isMoodSheetOpen: boolean;
  isWideScreen: boolean;
  dailyDays: string;
  setDailyDays: Dispatch<SetStateAction<string>>;
  dailyProgressEnd: number;
  setDailyProgressEnd: Dispatch<SetStateAction<number>>;
  showIsMovie: boolean;
  setShowIsMovie: Dispatch<SetStateAction<boolean>>;
  showStartEpisode: string;
  setShowStartEpisode: Dispatch<SetStateAction<string>>;
  mainTab: string;
  rpgSubtab: string;
  focusedGoalId: string | null;
  piggyInputs: Record<string, string>;
  setPiggyInputs: Dispatch<SetStateAction<Record<string, string>>>;
  handleUpdatePiggy: (id: string, value: number, isAdd: boolean) => void;
}

export const Header = memo(({
  panGesture,
  moods,
  tailStyle,
  animatedStyle,
  activeView,
  setActiveView,
  setAuthState,
  setAuthMode,
  authMode,
  onMoodChange,
  rpgHistory,
  settings,
  closeSheet,
  contentAnimatedStyle,
  isMoodSheetOpen,
  isWideScreen,
  dailyDays,
  setDailyDays,
  dailyProgressEnd,
  setDailyProgressEnd,
  showIsMovie,
  setShowIsMovie,
  showStartEpisode,
  setShowStartEpisode,
  mainTab,
  rpgSubtab,
  focusedGoalId,
  piggyInputs,
  setPiggyInputs,
  handleUpdatePiggy
}: HeaderProps) => {
  const styles = useStyles(getStyles);
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const todayStr = getLogicalDateStr(settings?.reset_time, settings?.timezone);
  const todayEntry = rpgHistory?.find(item => item.date === todayStr);
  const currentMoodValue = todayEntry ? todayEntry.mood : null;

  return (
    <View style={[styles.header, isWideScreen && styles.webHeader]}>
      {isWideScreen ? (
        <>
          <View style={styles.webHeaderLeft}>
            {mainTab === 'rpg' && rpgSubtab === 'tv_shows' && (
              <View style={styles.webTvSettings}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setShowIsMovie(prev => !prev)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.webSettingsText}>{t('rpg_tv_is_movie')}</Text>
                  <View style={[
                    styles.keyboardSuggestionCheckbox,
                    showIsMovie && styles.keyboardSuggestionCheckboxChecked
                  ]}>
                    {showIsMovie && (
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: showIsMovie ? 0.35 : 1 }}>
                  <Text style={styles.webSettingsText}>{t('rpg_tv_episode')}</Text>
                  <TextInput
                    style={styles.episodeInput}
                    value={showStartEpisode}
                    onChangeText={text => {
                      const digits = text.replace(/[^0-9]/g, '');
                      setShowStartEpisode(digits);
                    }}
                    keyboardType="numeric"
                    editable={!showIsMovie}
                    selectTextOnFocus={true}
                  />
                </View>
              </View>
            )}

            {mainTab === 'rpg' && rpgSubtab === 'piggy_bank' && focusedGoalId && (
              <View style={styles.webTvSettings}>
                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderColor: '#EF4444',
                    borderWidth: 1.5,
                    borderRadius: theme.radius.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    height: 38,
                    gap: 6,
                    cursor: 'pointer'
                  }}
                  onPress={() => {
                    const inputVal = parseInt(piggyInputs[focusedGoalId], 10) || 0;
                    handleUpdatePiggy(focusedGoalId, inputVal, false);
                    setPiggyInputs(prev => ({ ...prev, [focusedGoalId]: '' }));
                  }}
                >
                  <MaterialCommunityIcons name="minus" size={20} color="#EF4444" />
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#EF4444' }}>{t('rpg_piggy_deduct')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(52, 211, 153, 0.12)',
                    borderColor: '#34D399',
                    borderWidth: 1.5,
                    borderRadius: theme.radius.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    height: 38,
                    gap: 6,
                    cursor: 'pointer'
                  }}
                  onPress={() => {
                    const inputVal = parseInt(piggyInputs[focusedGoalId], 10) || 0;
                    handleUpdatePiggy(focusedGoalId, inputVal, true);
                    setPiggyInputs(prev => ({ ...prev, [focusedGoalId]: '' }));
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#34D399" />
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#34D399' }}>{t('rpg_piggy_deposit')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.webHeaderCenter}>
            <TouchableOpacity
              onPress={() => {
                if (authMode === 'auth') {
                  Toast.show({
                    type: 'success',
                    text1: t('hdr_cloud_active'),
                    text2: t('hdr_cloud_desc'),
                    visibilityTime: 2500,
                  });
                } else {
                  Toast.show({
                    type: 'info',
                    text1: t('hdr_local_mode'),
                    text2: t('hdr_local_desc'),
                    visibilityTime: 2500,
                  });
                }
              }}
              style={[styles.headerButton, { marginRight: 5 }]}
            >
              <MaterialCommunityIcons
                name={authMode === 'auth' ? 'cloud' : 'cloud-off-outline'}
                size={45}
                color={authMode === 'auth' ? theme.colors.primary : theme.colors.text.muted}
              />
            </TouchableOpacity>

            <View style={styles.scoreContainer}>
              <Text style={{ fontSize: 20, color: theme.colors.text.primary }} numberOfLines={1}>{t('hdr_how_are_things')}</Text>
              <ReAnimated.View
                style={[styles.invisibleShade, tailStyle]}
                pointerEvents={isMoodSheetOpen ? 'auto' : 'none'}
              >
                <TouchableOpacity
                  style={{ width: '100%', height: '100%' }}
                  activeOpacity={1}
                  onPress={closeSheet}
                />
              </ReAnimated.View>
              <ReAnimated.View
                style={styles.contentPlaceholder}
                pointerEvents={isMoodSheetOpen ? 'auto' : 'none'}
              >
                <ReAnimated.View style={[styles.moodMeter, contentAnimatedStyle]}>
                  {moods.map((mood) => {
                    const isSelected = currentMoodValue === mood.value;
                    const isAnySelected = currentMoodValue !== null && currentMoodValue !== undefined;
                    const opacity = isSelected ? 1.0 : (isAnySelected ? 0.35 : 0.65);

                    return (
                      <TouchableOpacity
                        key={mood.value}
                        onPress={() => {
                          if (onMoodChange) onMoodChange(mood.value);
                        }}
                        style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: opacity,
                          transform: [{ scale: isSelected ? 1.3 : 1.0 }],
                        }}
                      >
                        <MaterialCommunityIcons name={mood.icon as any} size={50} color={mood.color} />
                      </TouchableOpacity>
                    );
                  })}
                </ReAnimated.View>
              </ReAnimated.View>
              <GestureDetector gesture={panGesture}>
                <ReAnimated.View style={[styles.scoreShade, animatedStyle, { cursor: 'pointer' }]}>
                  <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons
                      name={'caret-down'}
                      size={20}
                      color={theme.colors.icon.primary}
                    />
                  </View>
                </ReAnimated.View>
              </GestureDetector>
            </View>

            <TouchableOpacity
              onPress={() => setActiveView(prev => prev === 'recycle' ? 'list' : 'recycle')}
              style={[
                styles.headerButton,
                activeView === 'recycle' && styles.headerButtonActive,
                { marginRight: 5 }
              ]}
            >
              <Ionicons
                name={'trash-outline'}
                size={45}
                color={activeView === 'recycle' ? theme.colors.icon.active : theme.colors.icon.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (activeView === 'settings') {
                  setActiveView('list');
                } else {
                  setActiveView('settings');
                  setAuthState('');
                  if (!authMode) {
                    setAuthMode('local');
                  }
                }
              }}
              style={[
                styles.headerButton,
                activeView === 'settings' && styles.headerButtonActive
              ]}
            >
              <Ionicons
                name={'settings-outline'}
                size={45}
                color={activeView === 'settings' ? theme.colors.icon.active : theme.colors.icon.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.webHeaderRight}>
            <View style={styles.webDailySettings}>
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                {t('daily_weekdays').map((day, idx) => {
                  const isSelected = dailyDays[idx] === '1';
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => {
                        setDailyDays(prev => {
                          const arr = prev.split('');
                          arr[idx] = arr[idx] === '1' ? '0' : '1';
                          if (arr.every(x => x === '0')) return prev;
                          return arr.join('');
                        });
                      }}
                      style={[
                        styles.weekdayBtn,
                        isSelected && styles.weekdayBtnSelected
                      ]}
                    >
                      <Text style={[
                        styles.weekdayBtnText,
                        isSelected && styles.weekdayBtnTextSelected
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity hitSlop={15} onPress={() => {
                  setDailyProgressEnd(dailyProgressEnd === 1 ? 1 : dailyProgressEnd - 1);
                }}>
                  <Ionicons name="remove-circle-outline" size={24} color={theme.colors.icon.primary} />
                </TouchableOpacity>
                <Text style={styles.progressValueText}>
                  {dailyProgressEnd}
                </Text>
                <TouchableOpacity hitSlop={15} onPress={() => {
                  setDailyProgressEnd(dailyProgressEnd === 20 ? 20 : dailyProgressEnd + 1);
                }}>
                  <Ionicons name="add-circle-outline" size={24} color={theme.colors.icon.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      ) : (
        <>
          <TouchableOpacity
            onPress={() => {
              if (authMode === 'auth') {
                Toast.show({
                  type: 'success',
                  text1: t('hdr_cloud_active'),
                  text2: t('hdr_cloud_desc'),
                  visibilityTime: 2500,
                });
              } else {
                Toast.show({
                  type: 'info',
                  text1: t('hdr_local_mode'),
                  text2: t('hdr_local_desc'),
                  visibilityTime: 2500,
                });
              }
            }}
            style={[styles.headerButton, { marginRight: 5, height: 50 }]}
          >
            <MaterialCommunityIcons
              name={authMode === 'auth' ? 'cloud' : 'cloud-off-outline'}
              size={45}
              color={authMode === 'auth' ? theme.colors.primary : theme.colors.text.muted}
            />
          </TouchableOpacity>

          <View style={styles.scoreContainer}>
            <Text style={{ fontSize: 20, color: theme.colors.text.primary }}>{t('hdr_how_are_things')}</Text>
            <ReAnimated.View
              style={[styles.invisibleShade, tailStyle]}
              pointerEvents={isMoodSheetOpen ? 'auto' : 'none'}
            >
              <TouchableOpacity
                style={{ width: '100%', height: '100%' }}
                activeOpacity={1}
                onPress={closeSheet}
              />
            </ReAnimated.View>
            <ReAnimated.View
              style={styles.contentPlaceholder}
              pointerEvents={isMoodSheetOpen ? 'auto' : 'none'}
            >
              <ReAnimated.View style={[styles.moodMeter, contentAnimatedStyle]}>
                {moods.map((mood) => {
                  const isSelected = currentMoodValue === mood.value;
                  const isAnySelected = currentMoodValue !== null && currentMoodValue !== undefined;
                  const opacity = isSelected ? 1.0 : (isAnySelected ? 0.35 : 0.65);

                  return (
                    <TouchableOpacity
                      key={mood.value}
                      onPress={() => {
                        if (onMoodChange) onMoodChange(mood.value);
                      }}
                      style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: opacity,
                        transform: [{ scale: isSelected ? 1.3 : 1.0 }],
                      }}
                    >
                      <MaterialCommunityIcons name={mood.icon as any} size={50} color={mood.color} />
                    </TouchableOpacity>
                  );
                })}
              </ReAnimated.View>
            </ReAnimated.View>
            <GestureDetector gesture={panGesture}>
              <ReAnimated.View style={[styles.scoreShade, animatedStyle, { cursor: 'pointer' }]}>
                <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons
                    name={'caret-down'}
                    size={20}
                    color={theme.colors.icon.primary}
                  />
                </View>
              </ReAnimated.View>
            </GestureDetector>
          </View>

          <TouchableOpacity
            onPress={() => setActiveView(prev => prev === 'recycle' ? 'list' : 'recycle')}
            style={[
              styles.headerButton,
              activeView === 'recycle' && styles.headerButtonActive,
              { marginRight: 5, height: 50 }
            ]}
          >
            <Ionicons
              name={'trash-outline'}
              size={45}
              color={activeView === 'recycle' ? theme.colors.icon.active : theme.colors.icon.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (activeView === 'settings') {
                setActiveView('list');
              } else {
                setActiveView('settings');
                setAuthState('');
                if (!authMode) {
                  setAuthMode('local');
                }
              }
            }}
            style={[
              styles.headerButton,
              activeView === 'settings' && styles.headerButtonActive,
              { height: 50 }
            ]}
          >
            <Ionicons
              name={'settings-outline'}
              size={45}
              color={activeView === 'settings' ? theme.colors.icon.active : theme.colors.icon.primary}
            />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
});

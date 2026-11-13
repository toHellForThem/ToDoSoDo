import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Theme } from '../../theme/theme';
import { MoodConfigItem } from '../../domain/moods';
import { Translate } from '../settings/types';

interface RpgDashboardProps {
  today: Date;
  todayMonthGenitive: string;
  dailyStats: {
    dailiesProgress: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
  };
  todayMood: number | null;
  activeMoodConfig: Record<number, MoodConfigItem & { label: string }>;
  onOpenCalendar: () => void;
  onSelectSubtab: (subtab: 'habits' | 'piggy_bank' | 'tv_shows') => void;
  styles: any;
  theme: Theme;
  t: Translate;
}

const MENU_ITEMS: Array<{
  subtab: 'habits' | 'piggy_bank' | 'tv_shows';
  icon: string;
  titleKey: 'rpg_menu_habits' | 'rpg_menu_piggy' | 'rpg_menu_tv';
  subtitleKey: 'rpg_menu_habits_desc' | 'rpg_menu_piggy_desc' | 'rpg_menu_tv_desc';
}> = [
  { subtab: 'habits', icon: 'shield-star-outline', titleKey: 'rpg_menu_habits', subtitleKey: 'rpg_menu_habits_desc' },
  { subtab: 'piggy_bank', icon: 'piggy-bank-outline', titleKey: 'rpg_menu_piggy', subtitleKey: 'rpg_menu_piggy_desc' },
  { subtab: 'tv_shows', icon: 'television-play', titleKey: 'rpg_menu_tv', subtitleKey: 'rpg_menu_tv_desc' },
];

/** Дашборд RPG: дата, статистика дня и карточки подтабов. */
export const RpgDashboard = memo(({
  today,
  todayMonthGenitive,
  dailyStats,
  todayMood,
  activeMoodConfig,
  onOpenCalendar,
  onSelectSubtab,
  styles,
  theme,
  t,
}: RpgDashboardProps) => {
  const hasTodayMood = todayMood && activeMoodConfig[todayMood];
  const dateBtnBg = hasTodayMood ? activeMoodConfig[todayMood].dashboardBg : theme.colors.surface;
  const dateBtnBorder = hasTodayMood ? activeMoodConfig[todayMood].color : theme.colors.primary;
  const dateBtnTextColor = hasTodayMood ? activeMoodConfig[todayMood].color : theme.colors.primary;

  return (
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
            onPress={onOpenCalendar}
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
        {MENU_ITEMS.map(({ subtab, icon, titleKey, subtitleKey }) => (
          <TouchableOpacity
            key={subtab}
            style={styles.menuCard}
            onPress={() => onSelectSubtab(subtab)}
          >
            <View style={styles.menuIconContainer}>
              <MaterialCommunityIcons name={icon as any} size={45} color={theme.colors.icon.primary} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>{t(titleKey)}</Text>
              <Text style={styles.menuSubtitle}>{t(subtitleKey)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

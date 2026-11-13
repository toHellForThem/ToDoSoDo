import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SectionStyleProps } from './types';

interface ResetTimeSectionProps extends SectionStyleProps {
  hours: number;
  minutes: number;
  changeHours: (delta: number) => void;
  changeMinutes: (delta: number) => void;
}

/** Время логического сброса дня. */
export const ResetTimeSection = ({
  hours,
  minutes,
  changeHours,
  changeMinutes,
  styles,
  theme,
  t,
}: ResetTimeSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderWithIcon}>
        <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.cardTitle}>{t('set_reset_time_title')}</Text>
      </View>
      <View style={styles.clockCenterContainer}>
        <View style={styles.compactClock}>
          <View style={styles.compactClockGroup}>
            <TouchableOpacity
              onPress={() => changeHours(-1)}
              style={[styles.clockControlBtn, styles.clockControlBtnLeft]}
              activeOpacity={0.6}
            >
              <Ionicons name="remove" size={22} color={theme.colors.icon.primary} />
            </TouchableOpacity>
            <View style={styles.clockValueBg}>
              <Text style={styles.clockValueLabel}>{t('set_hours')}</Text>
              <Text style={styles.clockValueText}>
                {hours.toString().padStart(2, '0')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => changeHours(1)}
              style={[styles.clockControlBtn, styles.clockControlBtnRight]}
              activeOpacity={0.6}
            >
              <Ionicons name="add" size={22} color={theme.colors.icon.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.compactSeparator}>:</Text>
          <View style={styles.compactClockGroup}>
            <TouchableOpacity
              onPress={() => changeMinutes(-5)}
              style={[styles.clockControlBtn, styles.clockControlBtnLeft]}
              activeOpacity={0.6}
            >
              <Ionicons name="remove" size={22} color={theme.colors.icon.primary} />
            </TouchableOpacity>
            <View style={styles.clockValueBg}>
              <Text style={styles.clockValueLabel}>{t('set_minutes')}</Text>
              <Text style={styles.clockValueText}>
                {minutes.toString().padStart(2, '0')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => changeMinutes(5)}
              style={[styles.clockControlBtn, styles.clockControlBtnRight]}
              activeOpacity={0.6}
            >
              <Ionicons name="add" size={22} color={theme.colors.icon.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

interface DailyConfigSectionProps extends SectionStyleProps {
  onEditDailies: () => void;
}

/** Переход к редактированию daily-задач. */
export const DailyConfigSection = ({
  onEditDailies,
  styles,
  theme,
  t,
}: DailyConfigSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderWithIcon}>
        <MaterialCommunityIcons name="calendar-check" size={20} color={theme.colors.primary} />
        <Text style={styles.cardTitle}>{t('set_daily_config_title')}</Text>
      </View>
      <Text style={{ fontSize: 11, color: theme.colors.text.muted, marginLeft: theme.spacing.sm, marginTop: 4, marginBottom: 12 }}>
        {t('set_daily_config_desc')}
      </Text>
      <TouchableOpacity
        onPress={onEditDailies}
        style={[styles.logoutButton, { marginTop: 4, paddingVertical: 10 }]}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="calendar-edit" size={18} color={theme.colors.icon.primary} style={{ marginRight: 6 }} />
        <Text style={styles.logoutButtonText}>{t('set_daily_edit')}</Text>
      </TouchableOpacity>
    </View>
  );
};

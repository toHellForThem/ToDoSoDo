import { memo, Dispatch, SetStateAction } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Theme } from '../../theme/theme';
import { TranslationDict } from '../../utils/translations';
import { CalendarMoodConfigItem, DayHabit, SelectedDayDetail } from './types';

interface CalendarDayDetailProps {
  selectedDayDetail: SelectedDayDetail;
  displayProgress: number | string;
  displayPosPoints: number;
  displayNegPoints: number;
  displayNeuPoints: number;
  dayHabits: DayHabit[];
  activeMoodConfig: Record<string | number, CalendarMoodConfigItem>;
  isHabitsExpanded: boolean;
  setIsHabitsExpanded: Dispatch<SetStateAction<boolean>>;
  selectedDayMonthGenitive: string;
  styles: any;
  theme: Theme;
  t: <K extends keyof TranslationDict>(
    key: K,
    options?: Record<string, string | number>,
  ) => TranslationDict[K];
}

/** Детали выбранного дня: настроение, прогресс и раскрывающийся список привычек. */
export const CalendarDayDetail = memo(function CalendarDayDetail({
  selectedDayDetail,
  displayProgress,
  displayPosPoints,
  displayNegPoints,
  displayNeuPoints,
  dayHabits,
  activeMoodConfig,
  isHabitsExpanded,
  setIsHabitsExpanded,
  selectedDayMonthGenitive,
  styles,
  theme,
  t,
}: CalendarDayDetailProps) {
  return (
    <View style={styles.dayDetailBlock}>
      <Text style={styles.dayDetailTitle}>
        {t('rpg_cal_summary', {
          day: selectedDayDetail.day,
          month: selectedDayMonthGenitive,
        })}
      </Text>

      <View style={styles.dayDetailGrid}>
        <View style={styles.dayDetailItem}>
          <Text style={styles.statLabel}>{t('rpg_cal_mood')}</Text>
          {selectedDayDetail.log.mood ? (
            <MaterialCommunityIcons
              name={
                activeMoodConfig[selectedDayDetail.log.mood ?? -1]?.icon as any
              }
              size={28}
              color={
                activeMoodConfig[selectedDayDetail.log.mood ?? -1]?.color as any
              }
              style={{ marginTop: 4 }}
            />
          ) : (
            <Text style={styles.dayDetailValue}>—</Text>
          )}
        </View>

        <View style={styles.dayDetailItem}>
          <Text style={styles.statLabel}>{t('rpg_cal_progress')}</Text>
          <Text
            style={[styles.dayDetailValue, { color: theme.colors.primary }]}
          >
            {displayProgress}%
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dayDetailItem}
          onPress={() => setIsHabitsExpanded(prev => !prev)}
          activeOpacity={0.7}
        >
          <Text style={styles.statLabel}>{t('rpg_cal_habits')}</Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
          >
            <Text
              style={[
                styles.dayDetailValue,
                { color: '#34D399', marginTop: 0 },
              ]}
            >
              +{displayPosPoints}
            </Text>
            <Text
              style={[
                styles.dayDetailValue,
                { color: '#94A3B8', marginTop: 0, marginHorizontal: 8 },
              ]}
            >
              {displayNeuPoints}
            </Text>
            <Text
              style={[
                styles.dayDetailValue,
                { color: '#EF4444', marginTop: 0 },
              ]}
            >
              -{displayNegPoints}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={isHabitsExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#94A3B8"
            style={{ marginTop: 2 }}
          />
        </TouchableOpacity>
      </View>

      {isHabitsExpanded && (
        <View
          style={{
            marginTop: 6,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border.light,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.light,
            maxHeight: 206,
          }}
        >
          {dayHabits.length > 0 ? (
            <FlatList
              data={dayHabits}
              bounces={false}
              overScrollMode="never"
              keyExtractor={(habit, idx) => habit.id || idx.toString()}
              contentContainerStyle={{ gap: 6, paddingVertical: 6 }}
              renderItem={({ item: habit }) => {
                const iconBg =
                  habit.contribution === 1
                    ? 'rgba(52, 211, 153, 0.12)'
                    : habit.contribution === -1
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(148, 163, 184, 0.12)';

                const iconColor =
                  habit.contribution === 1
                    ? '#34D399'
                    : habit.contribution === -1
                      ? '#EF4444'
                      : '#94A3B8';

                const iconName =
                  habit.contribution === 1
                    ? 'plus'
                    : habit.contribution === -1
                      ? 'minus'
                      : 'help';

                return (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: theme.colors.surface,
                      borderRadius: 10,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: theme.colors.border.light,
                    }}
                  >
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        backgroundColor: iconBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={iconName}
                        size={15}
                        color={iconColor}
                      />
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: theme.colors.text.primary,
                        fontWeight: '500',
                      }}
                    >
                      {habit.text}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: theme.colors.text.secondary,
                      }}
                    >
                      {habit.progressNow || 0}
                    </Text>
                  </View>
                );
              }}
            />
          ) : (
            <Text
              style={{
                fontSize: 13,
                color: '#94A3B8',
                textAlign: 'center',
                fontStyle: 'italic',
                marginTop: 4,
              }}
            >
              {t('rpg_cal_no_habits')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

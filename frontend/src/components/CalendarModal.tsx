import { memo, Dispatch, SetStateAction } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { RpgHistoryItem } from '../utils/storage';
import { Theme } from '../theme/theme';
import { TranslationDict } from '../utils/translations';


export interface CalendarCell {
  day: number | null;
  dateStr: string | null;
}

export interface SelectedDayDetail {
  day: number;
  dateStr: string;
  log: RpgHistoryItem;
}

interface DayHabit {
  id?: string;
  text: string;
  contribution: number;
  progressNow: number | string;
}

interface MoodConfigItem {
  icon: string;
  color: string;
  glassBg: string;
}

interface CalendarModalProps {
  isCalendarVisible: boolean;
  setCalendarVisible: (visible: boolean) => void;
  currentMonthName: string;
  viewDate: Date;
  calendarCells: CalendarCell[];
  selectedDayDetail: SelectedDayDetail | null;
  setSelectedDayDetail: (detail: SelectedDayDetail | null) => void;
  isHabitsExpanded: boolean;
  setIsHabitsExpanded: Dispatch<SetStateAction<boolean>>;
  displayProgress: number | string;
  displayPosPoints: number;
  displayNegPoints: number;
  displayNeuPoints: number;
  dayHabits: DayHabit[];
  activeMoodConfig: Record<string | number, MoodConfigItem>;
  rpgHistory: RpgHistoryItem[];
  todayStr: string;
  selectedDayMonthGenitive: string;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  handleDayPress: (cell: CalendarCell) => void;
  styles: any;
  theme: Theme;
  t: <K extends keyof TranslationDict>(
    key: K,
    options?: Record<string, string | number>
  ) => TranslationDict[K];
}

export const CalendarModal = memo(({
  isCalendarVisible,
  setCalendarVisible,
  currentMonthName,
  viewDate,
  calendarCells,
  selectedDayDetail,
  setSelectedDayDetail,
  isHabitsExpanded,
  setIsHabitsExpanded,
  displayProgress,
  displayPosPoints,
  displayNegPoints,
  displayNeuPoints,
  dayHabits,
  activeMoodConfig,
  rpgHistory,
  todayStr,
  selectedDayMonthGenitive,
  handlePrevMonth,
  handleNextMonth,
  handleDayPress,
  styles,
  theme,
  t,
}: CalendarModalProps) => {
  return (
    <Modal
      visible={isCalendarVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        setCalendarVisible(false);
        setSelectedDayDetail(null);
        setIsHabitsExpanded(false);
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>

          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              zIndex: 10,
            }}
            onPress={() => {
              setCalendarVisible(false);
              setSelectedDayDetail(null);
              setIsHabitsExpanded(false);
            }}
          >
            <Ionicons
              style={{
                padding: 8,
                borderBottomLeftRadius: 14,
                borderTopRightRadius: 14,
                backgroundColor: theme.colors.icon.bg,
              }}
              name="close"
              size={32}
              color={theme.colors.icon.primary}
            />
          </TouchableOpacity>

          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 10,
              backgroundColor: theme.colors.icon.bg,
              borderBottomRightRadius: 14,
              borderTopLeftRadius: 14,
              paddingVertical: 6,
              paddingHorizontal: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={{
                padding: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={28} color={theme.colors.icon.primary} />
            </TouchableOpacity>

            <Text
              style={{
                fontSize: 19,
                fontWeight: 'bold',
                color: theme.colors.text.primary,
                textTransform: 'uppercase',
                minWidth: 156,
                textAlign: 'center',
              }}
            >
              {currentMonthName} {viewDate.getFullYear()}
            </Text>

            <TouchableOpacity
              onPress={handleNextMonth}
              style={{
                padding: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-forward" size={28} color={theme.colors.icon.primary} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 42 }} />

          <View style={styles.calendarGrid}>
            {calendarCells.map((cell, index) => {
              const dayLog = cell.dateStr ? rpgHistory.find(h => h.date === cell.dateStr) : null;
              const cellMood = dayLog?.mood ?? null;
              const hasCellMood = cellMood != null && activeMoodConfig[cellMood];
              const isToday = cell.dateStr === todayStr;
              const isSelected = selectedDayDetail && selectedDayDetail.dateStr === cell.dateStr;

              let cellBg = 'transparent';
              let cellBorderColor = 'transparent';
              let cellTextColor = theme.colors.text.secondary;
              let cellBorderWidth = 0;

              if (cell.day) {
                if (hasCellMood && cellMood != null) {
                  cellBg = activeMoodConfig[cellMood].glassBg;
                  cellBorderColor = activeMoodConfig[cellMood].color;
                  cellTextColor = activeMoodConfig[cellMood].color;
                  cellBorderWidth = isSelected ? 3 : 1.5;
                } else {
                  cellBg = theme.colors.border.light;
                  if (isToday) {
                    cellBorderColor = theme.colors.primary;
                    cellBorderWidth = 1.5;
                    cellTextColor = theme.colors.primary;
                  }
                  if (isSelected) {
                    cellBorderColor = theme.colors.primary;
                    cellBorderWidth = 3;
                    cellTextColor = theme.colors.primary;
                  }
                }
              }

              return (
                <TouchableOpacity
                  key={index}
                  disabled={!cell.day}
                  style={[
                    styles.calendarCell,
                    {
                      backgroundColor: cellBg,
                      borderColor: cellBorderColor,
                      borderWidth: cellBorderWidth,
                    }
                  ]}
                  onPress={() => handleDayPress(cell)}
                >
                  {cell.day && (
                    <Text style={[
                      styles.calendarCellText,
                      {
                        color: cellTextColor,
                        fontWeight: (hasCellMood || isSelected || isToday) ? 'bold' : '600',
                      }
                    ]}>
                      {cell.day}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDayDetail && (
            <View style={styles.dayDetailBlock}>
              <Text style={styles.dayDetailTitle}>
                {t('rpg_cal_summary', { day: selectedDayDetail.day, month: selectedDayMonthGenitive })}
              </Text>

              <View style={styles.dayDetailGrid}>
                <View style={styles.dayDetailItem}>
                  <Text style={styles.statLabel}>{t('rpg_cal_mood')}</Text>
                  {selectedDayDetail.log.mood ? (
                    <MaterialCommunityIcons
                      name={activeMoodConfig[selectedDayDetail.log.mood ?? -1]?.icon as any}
                      size={28}
                      color={activeMoodConfig[selectedDayDetail.log.mood ?? -1]?.color as any}
                      style={{ marginTop: 4 }}
                    />
                  ) : (
                    <Text style={styles.dayDetailValue}>—</Text>
                  )}
                </View>

                <View style={styles.dayDetailItem}>
                  <Text style={styles.statLabel}>{t('rpg_cal_progress')}</Text>
                  <Text style={[styles.dayDetailValue, { color: theme.colors.primary }]}>
                    {displayProgress}%
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.dayDetailItem}
                  onPress={() => setIsHabitsExpanded(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.statLabel}>{t('rpg_cal_habits')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Text style={[styles.dayDetailValue, { color: '#34D399', marginTop: 0 }]}>
                      +{displayPosPoints}
                    </Text>
                    <Text style={[styles.dayDetailValue, { color: '#94A3B8', marginTop: 0, marginHorizontal: 8 }]}>
                      {displayNeuPoints}
                    </Text>
                    <Text style={[styles.dayDetailValue, { color: '#EF4444', marginTop: 0 }]}>
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
                <View style={{
                  marginTop: 6,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border.light,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border.light,
                  maxHeight: 206,
                }}>
                  {dayHabits.length > 0 ? (
                    <FlatList
                      data={dayHabits}
                      bounces={false}
                      overScrollMode="never"
                      keyExtractor={(habit, idx) => habit.id || idx.toString()}
                      contentContainerStyle={{ gap: 6, paddingVertical: 6 }}
                      renderItem={({ item: habit }) => {
                        const iconBg = habit.contribution === 1
                          ? 'rgba(52, 211, 153, 0.12)'
                          : habit.contribution === -1
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'rgba(148, 163, 184, 0.12)';

                        const iconColor = habit.contribution === 1
                          ? '#34D399'
                          : habit.contribution === -1
                            ? '#EF4444'
                            : '#94A3B8';

                        const iconName = habit.contribution === 1
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
                            <View style={{
                              width: 26,
                              height: 26,
                              borderRadius: 6,
                              backgroundColor: iconBg,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                            }}>
                              <MaterialCommunityIcons name={iconName} size={15} color={iconColor} />
                            </View>
                            <Text style={{
                              flex: 1,
                              fontSize: 14,
                              color: theme.colors.text.primary,
                              fontWeight: '500'
                            }}>
                              {habit.text}
                            </Text>
                            <Text style={{
                              fontSize: 14,
                              fontWeight: 'bold',
                              color: theme.colors.text.secondary
                            }}>
                              {habit.progressNow || 0}
                            </Text>
                          </View>
                        );
                      }}
                    />
                  ) : (
                    <Text style={{
                      fontSize: 13,
                      color: '#94A3B8',
                      textAlign: 'center',
                      fontStyle: 'italic',
                      marginTop: 4
                    }}>
                      {t('rpg_cal_no_habits')}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
});

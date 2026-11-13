import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { RpgHistoryItem } from '../../utils/storage';
import { Theme } from '../../theme/theme';
import { CalendarCell, CalendarMoodConfigItem, SelectedDayDetail } from './types';

interface CalendarGridProps {
  calendarCells: CalendarCell[];
  rpgHistory: RpgHistoryItem[];
  activeMoodConfig: Record<string | number, CalendarMoodConfigItem>;
  todayStr: string;
  selectedDayDetail: SelectedDayDetail | null;
  handleDayPress: (cell: CalendarCell) => void;
  styles: any;
  theme: Theme;
}

/** Сетка дней месяца с подсветкой настроения, сегодня и выбранного дня. */
export const CalendarGrid = memo(({
  calendarCells,
  rpgHistory,
  activeMoodConfig,
  todayStr,
  selectedDayDetail,
  handleDayPress,
  styles,
  theme,
}: CalendarGridProps) => {
  return (
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
  );
});

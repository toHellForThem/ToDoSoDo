import { memo, Dispatch, SetStateAction } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RpgHistoryItem } from '../utils/storage';
import { Theme } from '../theme/theme';
import { TranslationDict } from '../utils/translations';
import { CalendarGrid } from './calendar/CalendarGrid';
import { CalendarDayDetail } from './calendar/CalendarDayDetail';
import {
  CalendarCell,
  CalendarMoodConfigItem,
  DayHabit,
  SelectedDayDetail,
} from './calendar/types';

export type { CalendarCell, SelectedDayDetail } from './calendar/types';

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
  activeMoodConfig: Record<string | number, CalendarMoodConfigItem>;
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
  const closeModal = () => {
    setCalendarVisible(false);
    setSelectedDayDetail(null);
    setIsHabitsExpanded(false);
  };

  return (
    <Modal
      visible={isCalendarVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={closeModal}
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
            onPress={closeModal}
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

          <CalendarGrid
            calendarCells={calendarCells}
            rpgHistory={rpgHistory}
            activeMoodConfig={activeMoodConfig}
            todayStr={todayStr}
            selectedDayDetail={selectedDayDetail}
            handleDayPress={handleDayPress}
            styles={styles}
            theme={theme}
          />

          {selectedDayDetail && (
            <CalendarDayDetail
              selectedDayDetail={selectedDayDetail}
              displayProgress={displayProgress}
              displayPosPoints={displayPosPoints}
              displayNegPoints={displayNegPoints}
              displayNeuPoints={displayNeuPoints}
              dayHabits={dayHabits}
              activeMoodConfig={activeMoodConfig}
              isHabitsExpanded={isHabitsExpanded}
              setIsHabitsExpanded={setIsHabitsExpanded}
              selectedDayMonthGenitive={selectedDayMonthGenitive}
              styles={styles}
              theme={theme}
              t={t}
            />
          )}

        </View>
      </View>
    </Modal>
  );
});

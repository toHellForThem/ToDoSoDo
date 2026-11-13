import { RpgHistoryItem } from '../../utils/storage';

export interface CalendarCell {
  day: number | null;
  dateStr: string | null;
}

export interface SelectedDayDetail {
  day: number;
  dateStr: string;
  log: RpgHistoryItem;
}

export interface DayHabit {
  id?: string;
  text: string;
  contribution: number;
  progressNow: number | string;
}

export interface CalendarMoodConfigItem {
  icon: string;
  color: string;
  glassBg: string;
}

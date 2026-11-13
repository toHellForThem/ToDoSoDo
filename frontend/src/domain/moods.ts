import type { ThemeName } from '../utils/storage';
import { getTheme, type MoodColors } from '../theme/theme';

export interface MoodConfigItem {
  value: number;
  icon: string;
  color: string;
  glassBg: string;
  dashboardBg: string;
}

const MOOD_ICONS = [
  'emoticon-dead-outline',
  'emoticon-sad-outline',
  'emoticon-neutral-outline',
  'emoticon-happy-outline',
  'emoticon-excited-outline',
];

const buildConfig = (colors: MoodColors[]): Record<number, MoodConfigItem> => {
  const config: Record<number, MoodConfigItem> = {};
  colors.forEach((entry, index) => {
    const value = index + 1;
    config[value] = {
      value,
      icon: MOOD_ICONS[index],
      color: entry.color,
      glassBg: entry.glassBg,
      dashboardBg: entry.dashboardBg,
    };
  });
  return config;
};

/** Единый источник цветов и иконок настроений — цвета берутся из темы. */
export const getMoodConfig = (
  themeName: ThemeName | undefined,
): Record<number, MoodConfigItem> => {
  return buildConfig(getTheme(themeName ?? 'default').moods);
};

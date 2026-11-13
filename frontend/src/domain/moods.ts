import type { ThemeName } from '../utils/storage';

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

const buildConfig = (
  colors: Array<{ color: string; glassBg: string; dashboardBg: string }>
): Record<number, MoodConfigItem> => {
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

const DARK_MOODS = buildConfig([
  { color: '#94A3B8', glassBg: '#334155', dashboardBg: '#1E293B' },
  { color: '#FB7185', glassBg: '#4c0519', dashboardBg: '#881337' },
  { color: '#F59E0B', glassBg: '#451a03', dashboardBg: '#78350f' },
  { color: '#34D399', glassBg: '#064e3b', dashboardBg: '#065f46' },
  { color: '#C084FC', glassBg: '#2e1065', dashboardBg: '#4c1d95' },
]);

const MINT_MOODS = buildConfig([
  { color: '#64748B', glassBg: '#EDF2F7', dashboardBg: '#E2E8F0' },
  { color: '#F43F5E', glassBg: '#FFE4E6', dashboardBg: '#FECDD3' },
  { color: '#D98A2F', glassBg: '#FEF3C7', dashboardBg: '#FDE68A' },
  { color: '#10B981', glassBg: '#D1FAE5', dashboardBg: '#A7F3D0' },
  { color: '#8B5CF6', glassBg: '#EDE9FE', dashboardBg: '#DDD6FE' },
]);

const PINK_MOODS = buildConfig([
  { color: '#64748B', glassBg: '#EDF2F7', dashboardBg: '#E2E8F0' },
  { color: '#F43F5E', glassBg: '#FFE4E6', dashboardBg: '#FFD2E2' },
  { color: '#D98A2F', glassBg: '#FEF3C7', dashboardBg: '#FFEBC4' },
  { color: '#10B981', glassBg: '#D1FAE5', dashboardBg: '#E6F4EA' },
  { color: '#D946EF', glassBg: '#FDF4FF', dashboardBg: '#FAE8FF' },
]);

const DEFAULT_MOODS = buildConfig([
  { color: '#64748B', glassBg: '#EDF2F7', dashboardBg: '#CBD9EF' },
  { color: '#F43F5E', glassBg: '#FFE4E6', dashboardBg: '#DCD2E9' },
  { color: '#D98A2F', glassBg: '#FEF3C7', dashboardBg: '#D9DCE4' },
  { color: '#10B981', glassBg: '#D1FAE5', dashboardBg: '#C1E1EE' },
  { color: '#8B5CF6', glassBg: '#EDE9FE', dashboardBg: '#CFD6FC' },
]);

/** Единый источник цветов и иконок настроений для всех тем. */
export const getMoodConfig = (themeName: ThemeName | undefined): Record<number, MoodConfigItem> => {
  if (themeName === 'dark') return DARK_MOODS;
  if (themeName === 'mint') return MINT_MOODS;
  if (themeName === 'pink') return PINK_MOODS;
  return DEFAULT_MOODS;
};

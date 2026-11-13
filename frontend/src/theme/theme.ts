import { AuthStorage } from '../utils/storage';


export interface MoodColors {
  color: string;
  glassBg: string;
  dashboardBg: string;
}

export interface ThemeColors {
  primary: string,
  primaryLight: string,
  background: string,
  surface: string,
  text: {
    primary: string,
    secondary: string,
    muted: string,
    white: string,
    link: string,
  },
  border: {
    light: string,
    default: string,
  },
  danger: string,
  icon: {
    primary: string,
    active: string,
    bg: string,
    bgActive: string,
  }
}

export interface Theme {
  colors: ThemeColors;
  moods: MoodColors[];
  spacing: typeof spacing;
  radius: typeof radius;
  sizes: typeof sizes;
}

const DANGER_COLOR: string = '#EF4444';
const WHITE_COLOR: string = '#FFFFFF';

export const defaultColors: ThemeColors = {
  primary: '#3B82F6',
  primaryLight: '#d9e7fd',
  background: '#F1F5F9',
  surface: WHITE_COLOR,
  text: {
    primary: '#1E293B',
    secondary: '#64748B',
    muted: '#94A3B8',
    white: WHITE_COLOR,
    link: '#3B82F6',
  },
  border: {
    light: '#E2E8F0',
    default: '#CBD5E1',
  },
  danger: DANGER_COLOR,
  icon: {
    primary: '#3B82F6',
    active: WHITE_COLOR,
    bg: '#d9e7fd',
    bgActive: '#3B82F6',
  },
};

export const defaultMoodColors: MoodColors[] = [
  { color: '#64748B', glassBg: '#EDF2F7', dashboardBg: '#CBD9EF' },
  { color: '#F43F5E', glassBg: '#FFE4E6', dashboardBg: '#DCD2E9' },
  { color: '#D98A2F', glassBg: '#FEF3C7', dashboardBg: '#D9DCE4' },
  { color: '#10B981', glassBg: '#D1FAE5', dashboardBg: '#C1E1EE' },
  { color: '#8B5CF6', glassBg: '#EDE9FE', dashboardBg: '#CFD6FC' },
];

export const darkMoodColors: MoodColors[] = [
  { color: '#94A3B8', glassBg: '#334155', dashboardBg: '#1E293B' },
  { color: '#FB7185', glassBg: '#4c0519', dashboardBg: '#881337' },
  { color: '#F59E0B', glassBg: '#451a03', dashboardBg: '#78350f' },
  { color: '#34D399', glassBg: '#064e3b', dashboardBg: '#065f46' },
  { color: '#C084FC', glassBg: '#2e1065', dashboardBg: '#4c1d95' },
];

export const mintMoodColors: MoodColors[] = [
  { color: '#64748B', glassBg: '#EDF2F7', dashboardBg: '#E2E8F0' },
  { color: '#F43F5E', glassBg: '#FFE4E6', dashboardBg: '#FECDD3' },
  { color: '#D98A2F', glassBg: '#FEF3C7', dashboardBg: '#FDE68A' },
  { color: '#10B981', glassBg: '#D1FAE5', dashboardBg: '#A7F3D0' },
  { color: '#8B5CF6', glassBg: '#EDE9FE', dashboardBg: '#DDD6FE' },
];

export const pinkMoodColors: MoodColors[] = [
  { color: '#64748B', glassBg: '#EDF2F7', dashboardBg: '#E2E8F0' },
  { color: '#F43F5E', glassBg: '#FFE4E6', dashboardBg: '#FFD2E2' },
  { color: '#D98A2F', glassBg: '#FEF3C7', dashboardBg: '#FFEBC4' },
  { color: '#10B981', glassBg: '#D1FAE5', dashboardBg: '#E6F4EA' },
  { color: '#D946EF', glassBg: '#FDF4FF', dashboardBg: '#FAE8FF' },
];

export const darkColors = {
  primary: '#8B5CF6',
  primaryLight: '#2e1065',
  background: '#0F172A',
  surface: '#1E293B',
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
    white: WHITE_COLOR,
    link: '#A78BFA',
  },
  border: {
    light: '#334155',
    default: '#475569',
  },
  danger: DANGER_COLOR,
  icon: {
    primary: '#8B5CF6',
    active: WHITE_COLOR,
    bg: '#2e1065',
    bgActive: '#8B5CF6',
  },
};

export const mintColors = {
  primary: '#10B981',
  primaryLight: '#D1FAE5',
  background: '#F0FDF4',
  surface: WHITE_COLOR,
  text: {
    primary: '#064E3B',
    secondary: '#374151',
    muted: '#6B7280',
    white: WHITE_COLOR,
    link: '#10B981',
  },
  border: {
    light: '#E6F4EA',
    default: '#A7F3D0',
  },
  danger: DANGER_COLOR,
  icon: {
    primary: '#10B981',
    active: WHITE_COLOR,
    bg: '#D1FAE5',
    bgActive: '#10B981',
  },
};

export const pinkColors = {
  primary: '#EC4899',
  primaryLight: '#FCE7F3',
  background: '#FDF2F8',
  surface: WHITE_COLOR,
  text: {
    primary: '#3F2C35',
    secondary: '#5C4E55',
    muted: '#94A3B8',
    white: WHITE_COLOR,
    link: '#EC4899',
  },
  border: {
    light: '#FCE7F3',
    default: '#FBCFE8',
  },
  danger: DANGER_COLOR,
  icon: {
    primary: '#EC4899',
    active: WHITE_COLOR,
    bg: '#FCE7F3',
    bgActive: '#EC4899',
  },
};

const spacing = {
  xs: 4,
  sm: 8,
  smd: 10,
  md: 12,
  mdl: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 30,
}

const radius = {
  xs: 4,
  sm: 6,
  smd: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
}

const sizes = {
  headerHeight: 60,
  footerHeight: 70,
  checkbox: 24,
  floatingContainer: 50,
  progressBar: 10,
  moodMeterHeight: 374,
}

export const getTheme = (themeName: string): Theme => {
  let colors = defaultColors;
  let moods = defaultMoodColors;
  if (themeName === 'dark') {
    colors = darkColors;
    moods = darkMoodColors;
  } else if (themeName === 'mint') {
    colors = mintColors;
    moods = mintMoodColors;
  } else if (themeName === 'pink') {
    colors = pinkColors;
    moods = pinkMoodColors;
  }
  return {
    colors,
    moods,
    spacing,
    radius,
    sizes,
  };
};

const getActiveThemeName = (): string => {
  try {
    const saved = AuthStorage.getSettings();
    if (saved?.theme) {
      return saved.theme;
    }
  } catch (e) {
  }
  return 'default';
};

export const theme: Theme = getTheme(getActiveThemeName());

import { useMemo } from 'react';
import { getMoodConfig } from '../domain/moods';
import { useAppStore } from '../store/appStore';

export interface MoodItem {
  value: number;
  icon: string;
  color: string;
}

/** Настроения для шторки в шапке — берутся из общего конфига тем. */
export const useMoods = (): MoodItem[] => {
  const themeName = useAppStore(state => state.settings?.theme);

  return useMemo(() => {
    return Object.values(getMoodConfig(themeName)).map(
      ({ value, icon, color }) => ({
        value,
        icon,
        color,
      }),
    );
  }, [themeName]);
};

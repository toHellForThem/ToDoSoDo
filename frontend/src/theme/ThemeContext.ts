import { createContext, useContext, useMemo } from 'react';
import { getTheme, Theme } from './theme';

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: getTheme('default'),
  isDark: false,
});

export const useAppTheme = () => useContext(ThemeContext);

export const useStyles = <T>(styleCreator: (theme: Theme) => T): T => {
  const { theme } = useAppTheme();
  return useMemo(() => {
    return styleCreator(theme);
  }, [theme, styleCreator]);
};

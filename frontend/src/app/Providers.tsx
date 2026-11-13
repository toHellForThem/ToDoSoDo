import { ReactNode, useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getTheme } from '../theme/theme';
import { ThemeContext } from '../theme/ThemeContext';
import { LanguageProvider } from '../utils/LanguageContext';
import { useAppStore } from '../store/appStore';
import { injectWebGlobalStyles } from '../platform';

interface ProvidersProps {
  children: ReactNode;
}

/** Тема, язык, safe-area и gesture-handler — общая обвязка приложения. */
export const Providers = ({ children }: ProvidersProps) => {
  const themeName = useAppStore(state => state.settings?.theme);
  const language = useAppStore(state => state.settings?.language || 'ru');

  const theme = useMemo(() => getTheme(themeName), [themeName]);
  const isDark = themeName === 'dark';
  const themeContextValue = useMemo(() => ({ theme, isDark }), [theme, isDark]);

  useEffect(() => {
    injectWebGlobalStyles();
  }, []);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <LanguageProvider language={language}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            {children}
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </LanguageProvider>
    </ThemeContext.Provider>
  );
};

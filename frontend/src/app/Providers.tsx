import { ReactNode, useMemo } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getTheme } from '../theme/theme';
import { ThemeContext } from '../theme/ThemeContext';
import { LanguageProvider } from '../utils/LanguageContext';
import { useAppStore } from '../store/appStore';

const WEB_GLOBAL_STYLES = `
  body, html, * {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    outline: none !important;
  }
  *::-webkit-scrollbar {
    display: none !important;
  }
  * {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }
  input, textarea, [contenteditable="true"] {
    user-select: text !important;
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    -ms-user-select: text !important;
  }
`;

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

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <LanguageProvider language={language}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            {Platform.OS === 'web' && (
              <style dangerouslySetInnerHTML={{ __html: WEB_GLOBAL_STYLES }} />
            )}
            {children}
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </LanguageProvider>
    </ThemeContext.Provider>
  );
};

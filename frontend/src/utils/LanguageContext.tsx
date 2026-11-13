import { createContext, useContext, useMemo, ReactNode } from 'react';
import { translations, TranslationDict } from './translations';

interface LanguageContextType {
  language: string;
  t: <K extends keyof TranslationDict>(
    key: K,
    replacements?: Record<string, string | number>,
  ) => TranslationDict[K];
}

interface LanguageProviderProps {
  language?: string;
  children: ReactNode;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export const LanguageProvider = ({
  language = 'ru',
  children,
}: LanguageProviderProps) => {
  const t: LanguageContextType['t'] = useMemo(() => {
    return (key, replacements = {}) => {
      const dict = translations[language] || translations.ru;
      let text: string | string[] = dict[key] || translations.ru[key] || key;

      if (typeof text === 'string') {
        let str = text;
        for (const repKey of Object.keys(replacements)) {
          str = str.replace(`{${repKey}}`, String(replacements[repKey]));
        }
        return str as any;
      }
      return text as any;
    };
  }, [language]);

  const value = useMemo(() => ({ language, t }), [language, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
};

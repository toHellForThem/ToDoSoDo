import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { UserSettings, Language, ThemeName } from '../../utils/storage';
import { SectionStyleProps } from './types';

interface LanguageSectionProps extends SectionStyleProps {
  settings: UserSettings | undefined;
  handleLanguageChange: (language: Language) => void;
}

/** Выбор языка интерфейса. */
export const LanguageSection = ({
  settings,
  handleLanguageChange,
  styles,
  theme,
  t,
}: LanguageSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderWithIcon}>
        <Ionicons name="language-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.cardTitle}>{t('set_language')}</Text>
      </View>
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            (!settings?.language || settings?.language === 'ru') && styles.segmentButtonActive
          ]}
          onPress={() => handleLanguageChange('ru')}
        >
          <Text
            style={[
              styles.segmentText,
              (!settings?.language || settings?.language === 'ru') && styles.segmentTextActive
            ]}
          >
            {t('set_lang_ru')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            settings?.language === 'en' && styles.segmentButtonActive
          ]}
          onPress={() => handleLanguageChange('en')}
        >
          <Text
            style={[
              styles.segmentText,
              settings?.language === 'en' && styles.segmentTextActive
            ]}
          >
            {t('set_lang_en')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface ThemeSectionProps extends SectionStyleProps {
  settings: UserSettings | undefined;
  handleThemeChange: (theme: ThemeName) => void;
}

const THEMES: Array<{ value: ThemeName; labelKey: 'set_theme_blue' | 'set_theme_mint' | 'set_theme_pink' | 'set_theme_dark' }> = [
  { value: 'default', labelKey: 'set_theme_blue' },
  { value: 'mint', labelKey: 'set_theme_mint' },
  { value: 'pink', labelKey: 'set_theme_pink' },
  { value: 'dark', labelKey: 'set_theme_dark' },
];

/** Выбор цветовой темы. */
export const ThemeSection = ({
  settings,
  handleThemeChange,
  styles,
  theme,
  t,
}: ThemeSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderWithIcon}>
        <MaterialCommunityIcons name="palette-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.cardTitle}>{t('set_theme')}</Text>
      </View>
      <View style={styles.segmentedControl}>
        {THEMES.map(({ value, labelKey }) => {
          const isActive = value === 'default'
            ? (!settings?.theme || settings?.theme === 'default')
            : settings?.theme === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
              onPress={() => handleThemeChange(value)}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {t(labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UserSettings, RpgSubtab } from '../../utils/storage';
import { SectionStyleProps } from './types';

type UpdateSetting = <K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
) => void;

interface StartPageSectionProps extends SectionStyleProps {
  settings: UserSettings | undefined;
  updateSetting: UpdateSetting;
  activeRpgSubtab: RpgSubtab | null;
}

const MAIN_PAGES: {
  value: 'rpg' | 'todo' | 'daily';
  icon: string;
  labelKey: 'tab_rpg' | 'tab_todo' | 'tab_daily';
}[] = [
  { value: 'rpg', icon: 'sword-cross', labelKey: 'tab_rpg' },
  {
    value: 'todo',
    icon: 'checkbox-marked-circle-outline',
    labelKey: 'tab_todo',
  },
  { value: 'daily', icon: 'calendar-check', labelKey: 'tab_daily' },
];

const RPG_SUBTABS: {
  value: 'habits' | 'piggy_bank' | 'tv_shows';
  icon: string;
  labelKey: 'rpg_menu_habits' | 'rpg_menu_piggy' | 'rpg_menu_tv';
}[] = [
  { value: 'habits', icon: 'star-circle-outline', labelKey: 'rpg_menu_habits' },
  {
    value: 'piggy_bank',
    icon: 'piggy-bank-outline',
    labelKey: 'rpg_menu_piggy',
  },
  { value: 'tv_shows', icon: 'television-play', labelKey: 'rpg_menu_tv' },
];

/** Стартовая страница и подтаб RPG по умолчанию. */
export const StartPageSection = ({
  settings,
  updateSetting,
  activeRpgSubtab,
  styles,
  theme,
  t,
}: StartPageSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderWithIcon}>
        <MaterialCommunityIcons
          name="home-outline"
          size={20}
          color={theme.colors.primary}
        />
        <Text style={styles.cardTitle}>{t('set_start_page')}</Text>
      </View>
      <View style={styles.segmentedControl}>
        {MAIN_PAGES.map(({ value, icon, labelKey }) => {
          const isActive = settings?.main_page === value;
          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.segmentButton,
                isActive && styles.segmentButtonActive,
              ]}
              onPress={() => updateSetting('main_page', value)}
            >
              <MaterialCommunityIcons
                name={icon as any}
                size={16}
                color={
                  isActive
                    ? theme.colors.icon.primary
                    : theme.colors.text.secondary
                }
              />
              <Text
                style={[
                  styles.segmentText,
                  isActive && styles.segmentTextActive,
                ]}
              >
                {t(labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {settings?.main_page === 'rpg' && (
        <View style={styles.subtabContainer}>
          <View
            style={[
              styles.cardHeaderWithIcon,
              { marginTop: 10, marginBottom: 6 },
            ]}
          >
            <MaterialCommunityIcons
              name="layers-outline"
              size={16}
              color={theme.colors.primary}
            />
            <Text
              style={[
                styles.cardTitle,
                { fontSize: 13, color: theme.colors.text.secondary },
              ]}
            >
              {t('tab_rpg')}
            </Text>
          </View>
          <View style={styles.segmentedControl}>
            {RPG_SUBTABS.map(({ value, icon, labelKey }) => {
              const isActive = activeRpgSubtab === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.segmentButton,
                    isActive && styles.segmentButtonActive,
                  ]}
                  onPress={() => updateSetting('rpg_subtab', value)}
                >
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={14}
                    color={
                      isActive
                        ? theme.colors.icon.primary
                        : theme.colors.text.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      isActive && styles.segmentTextActive,
                      { fontSize: 11 },
                    ]}
                  >
                    {t(labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

interface SwitchSectionProps extends SectionStyleProps {
  settings: UserSettings | undefined;
  updateSetting: UpdateSetting;
}

/** Мягкое удаление задач в корзину. */
export const TrashSection = ({
  settings,
  updateSetting,
  styles,
  theme,
  t,
}: SwitchSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.switchRow}>
        <View style={styles.switchTextContainer}>
          <View style={styles.cardHeaderWithIcon}>
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={20}
              color={theme.colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('set_trash')}</Text>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.text.muted,
                  marginLeft: theme.spacing.sm,
                  marginTop: 2,
                }}
              >
                {t('set_trash_desc')}
              </Text>
            </View>
          </View>
        </View>
        <Switch
          value={settings?.soft_delete !== false}
          onValueChange={val => updateSetting('soft_delete', val)}
          trackColor={{
            false: theme.colors.border.light,
            true: theme.colors.primaryLight,
          }}
          thumbColor={
            settings?.soft_delete !== false
              ? theme.colors.primary
              : theme.colors.border.default
          }
        />
      </View>
    </View>
  );
};

/** Автоматический сброс daily по расписанию. */
export const ResetSection = ({
  settings,
  updateSetting,
  styles,
  theme,
  t,
}: SwitchSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.switchRow}>
        <View style={styles.switchTextContainer}>
          <View style={styles.cardHeaderWithIcon}>
            <MaterialCommunityIcons
              name="history"
              size={20}
              color={theme.colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('set_reset_card_title')}</Text>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.text.muted,
                  marginLeft: theme.spacing.sm,
                  marginTop: 2,
                }}
              >
                {t('set_reset_auto')}
              </Text>
            </View>
          </View>
        </View>
        <Switch
          value={settings?.reset_enabled !== false}
          onValueChange={val => updateSetting('reset_enabled', val)}
          trackColor={{
            false: theme.colors.border.light,
            true: theme.colors.primaryLight,
          }}
          thumbColor={
            settings?.reset_enabled !== false
              ? theme.colors.primary
              : theme.colors.border.default
          }
        />
      </View>
    </View>
  );
};

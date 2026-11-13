import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  UserSettings,
  ShortcutSettings,
  DEFAULT_SHORTCUTS,
} from '../../utils/storage';
import { formatKeyPart, normalizeCombination } from '../../commands';
import { SectionStyleProps } from './types';

type UpdateSetting = <K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
) => void;

interface ShortcutsSectionProps extends SectionStyleProps {
  settings: UserSettings | undefined;
  recordingKey: keyof ShortcutSettings | null;
  setRecordingKey: (key: keyof ShortcutSettings | null) => void;
  updateSetting: UpdateSetting;
}

/** Настройка горячих клавиш (только web). */
export const ShortcutsSection = ({
  settings,
  recordingKey,
  setRecordingKey,
  updateSetting,
  styles,
  theme,
  t,
}: ShortcutsSectionProps) => {
  const renderKeycaps = (
    shortcutStr: string | undefined,
    isRecording: boolean,
  ) => {
    if (isRecording) {
      return (
        <View style={[styles.keycap, styles.keycapActive]}>
          <Text style={[styles.keycapText, styles.keycapTextActive]}>
            {t('set_shortcut_press_key')}
          </Text>
        </View>
      );
    }
    if (!shortcutStr) return null;
    const parts = normalizeCombination(shortcutStr).split('+');
    return (
      <View style={styles.shortcutKeysContainer}>
        {parts.map((part, index) => {
          const text = formatKeyPart(part);
          return (
            <View
              key={index}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              {index > 0 && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: theme.colors.text.secondary,
                    marginHorizontal: 4,
                  }}
                >
                  +
                </Text>
              )}
              <View style={styles.keycap}>
                <Text style={styles.keycapText}>{text}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderWithIcon}>
        <MaterialCommunityIcons
          name="keyboard-outline"
          size={20}
          color={theme.colors.primary}
        />
        <Text style={styles.cardTitle}>{t('set_shortcuts_title')}</Text>
      </View>
      <Text
        style={{
          fontSize: 11,
          color: theme.colors.text.muted,
          marginTop: 4,
          marginBottom: 12,
        }}
      >
        {t('set_shortcuts_desc')}
      </Text>
      {(Object.keys(DEFAULT_SHORTCUTS) as (keyof ShortcutSettings)[]).map(
        key => (
          <View key={key} style={styles.shortcutRow}>
            <View style={styles.shortcutInfo}>
              <Text style={styles.shortcutTitle}>
                {t(`set_shortcut_action_${key}`)}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setRecordingKey(recordingKey === key ? null : key)}
            >
              {renderKeycaps(settings?.shortcuts?.[key], recordingKey === key)}
            </TouchableOpacity>
          </View>
        ),
      )}
      <TouchableOpacity
        onPress={() => {
          updateSetting('shortcuts', DEFAULT_SHORTCUTS);
          Toast.show({
            type: 'success',
            text1: t('set_shortcuts_reset_toast'),
            visibilityTime: 2000,
          });
        }}
        style={styles.shortcutResetButton}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name="restore"
          size={18}
          color={theme.colors.text.secondary}
        />
        <Text style={styles.shortcutResetButtonText}>
          {t('set_shortcuts_reset')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

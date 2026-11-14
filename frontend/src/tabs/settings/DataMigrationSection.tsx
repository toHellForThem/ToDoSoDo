import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SectionStyleProps } from './types';

interface DataMigrationSectionProps extends SectionStyleProps {
  handleExportData: () => void;
  handleImportData: () => void;
}

/**
 * Перенос локальных данных между Electron- и Tauri-сборками.
 * Показывается только в web-сборке (desktop).
 */
export const DataMigrationSection = ({
  handleExportData,
  handleImportData,
  styles,
  theme,
  t,
}: DataMigrationSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderWithIcon}>
        <MaterialCommunityIcons
          name="database-export"
          size={20}
          color={theme.colors.primary}
        />
        <Text style={styles.cardTitle}>{t('set_data_title')}</Text>
      </View>
      <Text
        style={{
          fontSize: 13,
          color: theme.colors.text.secondary,
          lineHeight: 18,
          marginTop: 10,
        }}
      >
        {t('set_data_desc')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          testID="data-export-button"
          style={[
            styles.primaryAuthButton,
            {
              height: 40,
              paddingVertical: 0,
              justifyContent: 'center',
              marginRight: 0,
            },
          ]}
          onPress={handleExportData}
        >
          <Text style={styles.primaryAuthButtonText}>
            {t('set_data_export')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="data-import-button"
          style={[
            styles.secondaryAuthButton,
            { height: 40, paddingVertical: 0, justifyContent: 'center' },
          ]}
          onPress={handleImportData}
        >
          <Text style={styles.secondaryAuthButtonText}>
            {t('set_data_import')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

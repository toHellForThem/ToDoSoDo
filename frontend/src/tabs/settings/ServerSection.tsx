import { View, Text, TouchableOpacity } from 'react-native';
import { TextInput as PaperInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SectionStyleProps } from './types';

interface ServerSectionProps extends SectionStyleProps {
  serverUrlInput: string;
  setServerUrlInput: (value: string) => void;
  handleSaveServerUrl: () => void;
  handleResetServerUrl: () => void;
}

/** Настройка адреса сервера и переподключение. */
export const ServerSection = ({
  serverUrlInput,
  setServerUrlInput,
  handleSaveServerUrl,
  handleResetServerUrl,
  styles,
  theme,
  t,
}: ServerSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderWithIcon}>
        <MaterialCommunityIcons name="server" size={20} color={theme.colors.primary} />
        <Text style={styles.cardTitle}>{t('set_server_config')}</Text>
      </View>
      <View style={{ marginTop: 12 }}>
        <PaperInput
          placeholder=" http://192.168.1.50:8000"
          value={serverUrlInput}
          onChangeText={setServerUrlInput}
          mode="outlined"
          outlineColor={theme.colors.border.light}
          textColor={theme.colors.text.primary}
          theme={{
            roundness: theme.radius.lg,
            colors: {
              primary: theme.colors.icon.primary,
            },
          }}
          placeholderTextColor={theme.colors.text.muted}
          style={styles.authInput}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <TouchableOpacity
            style={[styles.primaryAuthButton, { flex: 1, height: 40, paddingVertical: 0, justifyContent: 'center' }]}
            onPress={handleSaveServerUrl}
          >
            <Text style={styles.primaryAuthButtonText}>{t('set_save')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryAuthButton, { flex: 1, height: 40, paddingVertical: 0, justifyContent: 'center' }]}
            onPress={handleResetServerUrl}
          >
            <Text style={styles.secondaryAuthButtonText}>{t('set_reset_btn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

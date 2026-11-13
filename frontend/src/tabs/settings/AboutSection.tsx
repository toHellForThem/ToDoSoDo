import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SectionStyleProps } from './types';

interface AboutSectionProps extends SectionStyleProps {
  handleDonate: () => void;
}

/** О программе, версия и поддержка автора. */
export const AboutSection = ({
  handleDonate,
  styles,
  theme,
  t,
}: AboutSectionProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderWithIcon}>
        <MaterialCommunityIcons
          name="information-outline"
          size={20}
          color={theme.colors.primary}
        />
        <Text style={styles.cardTitle}>{t('set_about')}</Text>
      </View>
      <View style={{ marginTop: 12, alignItems: 'center' }}>
        <Image
          source={require('../../../assets/icon.png')}
          style={{ width: 64, height: 64, borderRadius: 14, marginBottom: 8 }}
        />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '800',
            color: theme.colors.text.primary,
          }}
        >
          ToDoSoDo
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: theme.colors.text.muted,
            marginTop: 2,
            fontWeight: '600',
          }}
        >
          {t('set_about') === 'О программе' ? 'Версия 1.0.2' : 'Version 1.0.2'}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: theme.colors.text.secondary,
            textAlign: 'center',
            marginTop: 10,
            lineHeight: 18,
            paddingHorizontal: 10,
          }}
        >
          {t('set_desc')}
        </Text>
        <TouchableOpacity
          onPress={handleDonate}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F59E0B',
            borderRadius: theme.radius.md,
            paddingVertical: 10,
            paddingHorizontal: 20,
            marginTop: 14,
            width: '100%',
            elevation: 1,
          }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="heart-pulse"
            size={18}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text
            style={{
              color: '#FFFFFF',
              fontWeight: '800',
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('set_support_author')}
          </Text>
        </TouchableOpacity>
        <View
          style={{
            width: '100%',
            height: 1,
            backgroundColor: theme.colors.border.light,
            marginVertical: 14,
          }}
        />
        <Text
          style={{
            fontSize: 11,
            color: theme.colors.text.muted,
            fontWeight: '500',
          }}
        >
          Copyright © 2026 toHellForThem. All rights reserved.
        </Text>
      </View>
    </View>
  );
};

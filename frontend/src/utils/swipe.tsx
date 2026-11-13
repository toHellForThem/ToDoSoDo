import { View, Animated, Text } from 'react-native';
import { Theme } from '../theme/theme';
import { getStyles } from '../styles/item.styles';
import { translations } from './translations';

export const renderLeftAction = (
  prog: any,
  drag: Animated.AnimatedInterpolation<number>,
  mode: string,
  theme: Theme,
  lang: string = 'ru',
  softDeleteEnabled: boolean = true,
) => {
  const styles = getStyles(theme);
  const isHardDelete = mode === 'hardDelete' || !softDeleteEnabled;
  const dict = translations[lang] || translations.ru;
  const label = isHardDelete ? dict.swipe_delete : dict.swipe_to_trash;

  const opacity = drag.interpolate({
    inputRange: [0, 30, 77 - (isHardDelete ? 2 : -6)],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });

  const translateX = drag.interpolate({
    inputRange: [0, 65, 77 - (isHardDelete ? 2 : -6)],
    outputRange: [
      -59 + (isHardDelete ? 2 : -6),
      7 + (isHardDelete ? 2 : -6),
      20,
    ],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={{
        height: '100%',
        justifyContent: 'center',
        paddingTop: 8,
        paddingBottom: 2,
        width: 90,
      }}
    >
      <Animated.View
        style={[
          styles.deleteBack,
          {
            opacity: opacity,
            marginRight: -510,
            transform: [{ translateX: translateX }],
            backgroundColor: isHardDelete
              ? theme.colors.danger
              : theme.colors.primary,
          },
        ]}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>{label}</Text>
      </Animated.View>
    </View>
  );
};

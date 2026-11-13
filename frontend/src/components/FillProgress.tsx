import { memo, useEffect, useRef, useMemo } from 'react';
import { View, Animated } from 'react-native';
import { getStyles } from './FillProgress.styles';
import { useStyles } from '../theme/ThemeContext';


interface FillProgressProps {
  progressNow: number;
  progressEnd: number;
}

export const FillProgress = memo(function FillProgress({ progressNow, progressEnd }: FillProgressProps) {
  const styles = useStyles(getStyles);
  const widthAnim = useRef(new Animated.Value(0)).current;
  const segments = useMemo(() => Array.from({ length: progressEnd }), [progressEnd]);

  useEffect(() => {
    const toValue = progressEnd > 0 ? (progressNow / progressEnd) * 100 : 0;
    Animated.timing(widthAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progressNow, progressEnd, widthAnim]);

  const widthPercent = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.backgroundContainer}>
      <Animated.View
        style={[
          styles.fill,
          { width: widthPercent }
        ]}
      />
      <View style={styles.grid}>
        {segments.map((_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              index === segments.length - 1 ? { height: '100%' } : {}
            ]}
          />
        ))}
      </View>
    </View>
  );
});

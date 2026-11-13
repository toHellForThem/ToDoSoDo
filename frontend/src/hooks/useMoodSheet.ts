import { useMemo, useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const MAX_PULL = 396;

const TIMING_CONFIG = {
  duration: 250,
  easing: Easing.out(Easing.quad),
};

export const useMoodSheet = (onStateChange?: (active: boolean) => void) => {
  const translateY = useSharedValue(0);
  const context = useSharedValue(0);
  const isActive = useSharedValue(0);

  const closeSheet = useCallback(() => {
    translateY.value = withTiming(0, TIMING_CONFIG);
    isActive.value = 0;
    if (onStateChange) onStateChange(false);
  }, [onStateChange, translateY, isActive]);

  const openSheet = useCallback(() => {
    translateY.value = withTiming(MAX_PULL, TIMING_CONFIG);
    isActive.value = 1;
    if (onStateChange) onStateChange(true);
  }, [onStateChange, translateY, isActive]);

  const toggleSheet = useCallback(() => {
    if (isActive.value === 1) {
      closeSheet();
    } else {
      openSheet();
    }
  }, [closeSheet, openSheet, isActive]);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .minDistance(10)
      .onStart(() => {
        context.value = translateY.value;
        if (onStateChange) runOnJS(onStateChange)(true);
      })
      .onUpdate(event => {
        let newValue = context.value + event.translationY;

        if (newValue < 0) newValue = 0;
        if (newValue > MAX_PULL) newValue = MAX_PULL;
        translateY.value = newValue;
      })
      .onEnd(event => {
        const swipeVelocity = event.velocityY;
        if (swipeVelocity > 500 || event.translationY > MAX_PULL * 0.4) {
          translateY.value = withTiming(MAX_PULL, TIMING_CONFIG);
          isActive.value = 1;
          if (onStateChange) runOnJS(onStateChange)(true);
        } else if (swipeVelocity < -500 || event.translationY < -100) {
          translateY.value = withTiming(0, TIMING_CONFIG);
          isActive.value = 0;
          if (onStateChange) runOnJS(onStateChange)(false);
        } else {
          if (translateY.value > MAX_PULL / 2) {
            translateY.value = withTiming(MAX_PULL, TIMING_CONFIG);
            isActive.value = 1;
            if (onStateChange) runOnJS(onStateChange)(true);
          } else {
            translateY.value = withTiming(0, TIMING_CONFIG);
            isActive.value = 0;
            if (onStateChange) runOnJS(onStateChange)(false);
          }
        }
      })
      .hitSlop({ vertical: 17 });
  }, [onStateChange, translateY, context, isActive]);

  const tapGesture = useMemo(() => {
    return Gesture.Tap().onEnd(() => {
      runOnJS(toggleSheet)();
    });
  }, [toggleSheet]);

  const composedGesture = useMemo(() => {
    return Gesture.Exclusive(panGesture, tapGesture);
  }, [panGesture, tapGesture]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const tailStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateY.value, [0, MAX_PULL], [0, 1]);
    return {
      opacity: opacity,
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(translateY.value, [0, MAX_PULL], [-400, 0]),
        },
      ],
    };
  });

  const contentPointerEvents = useDerivedValue(() => {
    return translateY.value > 20 ? 'auto' : 'none';
  });

  const animatedContentProps = useAnimatedProps(() => ({
    pointerEvents: contentPointerEvents.value,
  }));

  const tailProps = useAnimatedProps(() => ({
    pointerEvents: translateY.value > 20 ? 'auto' : 'none',
  }));

  return {
    panGesture: composedGesture,
    animatedStyle,
    tailStyle,
    tailProps,
    contentAnimatedStyle,
    animatedContentProps,
    closeSheet,
    openSheet,
    toggleSheet,
    isActive,
    translateY,
  };
};

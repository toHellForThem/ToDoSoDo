import { useCallback, useRef } from 'react';
import { GestureResponderEvent } from 'react-native';
import { isWeb } from '../platform';

const TAP_DISTANCE_THRESHOLD = 8;

/**
 * На web отличает тап от drag-жеста: если палец/курсор сместился больше
 * порога, нажатие не считается кликом. На нативных платформах просто
 * вызывает обработчик.
 */
export const useWebPressGuard = (onTap: () => void) => {
  const startX = useRef(0);
  const startY = useRef(0);

  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    if (isWeb) {
      startX.current = event.nativeEvent.pageX || 0;
      startY.current = event.nativeEvent.pageY || 0;
    }
  }, []);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (isWeb && event) {
        const endX = event.nativeEvent.pageX || 0;
        const endY = event.nativeEvent.pageY || 0;
        const distance = Math.sqrt(
          Math.pow(endX - startX.current, 2) +
            Math.pow(endY - startY.current, 2),
        );
        if (distance > TAP_DISTANCE_THRESHOLD) return;
      }
      onTap();
    },
    [onTap],
  );

  return { handlePressIn, handlePress };
};

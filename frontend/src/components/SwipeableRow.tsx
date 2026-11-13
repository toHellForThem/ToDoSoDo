import { memo, ReactNode, useCallback } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

export type SwipeActionMode = 'toRecycle' | 'hardDelete';

export type LeftActionRenderer = (
  progress: any,
  drag: any,
  mode: SwipeActionMode,
) => ReactNode;

interface SwipeableRowProps {
  leftAction: LeftActionRenderer;
  mode: SwipeActionMode;
  onSwipeLeftOpen: () => void;
  children: ReactNode;
  leftThreshold?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Общая обёртка строки списка: одинаковые параметры свайпа для задач,
 * daily и корзины, чтобы не дублировать их в каждом табе.
 */
export const SwipeableRow = memo(function SwipeableRow({
  leftAction,
  mode,
  onSwipeLeftOpen,
  children,
  leftThreshold = 78,
  containerStyle,
}: SwipeableRowProps) {
  const renderLeft = useCallback(
    (progress: any, drag: any) => leftAction(progress, drag, mode),
    [leftAction, mode],
  );

  return (
    <Swipeable
      friction={1.6}
      leftThreshold={leftThreshold}
      overshootLeft={true}
      renderLeftActions={renderLeft}
      onSwipeableLeftOpen={onSwipeLeftOpen}
      containerStyle={
        containerStyle ?? {
          paddingTop: 2,
          paddingBottom: 8,
          paddingHorizontal: 20,
          backgroundColor: 'transparent',
        }
      }
      activeOffsetX={[-15, 15]}
      failOffsetY={[-15, 15]}
    >
      {children}
    </Swipeable>
  );
});

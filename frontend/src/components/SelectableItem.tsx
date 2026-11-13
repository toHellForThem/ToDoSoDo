import { memo, ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { getStyles } from '../styles/item.styles';
import { useAppTheme, useStyles } from '../theme/ThemeContext';

interface SelectableItemProps {
  isSelected: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Контейнер строки списка с подсветкой выбранного элемента.
 * Используется всеми списками (todo, daily, recycle, rpg).
 */
export const SelectableItem = memo(function SelectableItem({
  isSelected,
  children,
  style,
}: SelectableItemProps) {
  const itemStyles = useStyles(getStyles);
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        itemStyles.todoItem,
        isSelected && { backgroundColor: theme.colors.icon.bg },
        style,
      ]}
    >
      {isSelected && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: theme.colors.primary,
            zIndex: 10,
          }}
        />
      )}
      {children}
    </View>
  );
});

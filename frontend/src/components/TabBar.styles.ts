import { StyleSheet } from 'react-native';
import { Theme } from '../theme/theme';

export const getStyles = (theme: Theme) =>
  StyleSheet.create({
    footer: {
      height: theme.sizes.footerHeight,
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
    },
    tab: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderTopColor: theme.colors.border.light,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 2,
    },
    activeTab: {
      borderTopColor: theme.colors.primary,
      backgroundColor: theme.colors.background,
    },
    tabText: {
      fontWeight: 'bold',
      fontSize: 12,
    },
  });

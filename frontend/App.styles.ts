import { StyleSheet } from 'react-native';
import { Theme } from './src/theme/theme';

export const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      zIndex: 51,
    },
    main: {
      flex: 1,
    },
    mainWide: {
      flexDirection: 'row',
    },
    dashboardContainer: {
      flex: 1,
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      backgroundColor: theme.colors.background,
    },
    column: {
      flex: 1,
      marginHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      borderWidth: 2.5,
      borderColor: 'transparent',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
    activeColumn: {
      borderColor: theme.colors.primary,
      elevation: 4,
      shadowOpacity: 0.1,
    },
    columnHeader: {
      height: 48,
      paddingHorizontal: theme.spacing.lg,
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
      backgroundColor: theme.colors.background,
    },
    columnTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text.primary,
    },
    columnContent: {
      flex: 1,
    },
  });

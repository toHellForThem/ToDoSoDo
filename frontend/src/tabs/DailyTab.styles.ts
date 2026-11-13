import { StyleSheet } from 'react-native';
import { Theme } from '../theme/theme';

export const getStyles = (theme: Theme) =>
  StyleSheet.create({
    todoWrapper: {
      flex: 1,
    },
    inputContainer: {
      flexDirection: 'row',
      marginTop: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
      borderBottomWidth: 1,
      borderColor: theme.colors.border.light,
      paddingHorizontal: theme.spacing.xl,
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.lg,
      fontSize: 16,
      color: theme.colors.text.primary,
      elevation: 2,
    },
    addButton: {
      backgroundColor: theme.colors.primaryLight,
      marginLeft: theme.spacing.smd,
      borderRadius: theme.radius.lg,
      width: 50,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 3,
    },
    floatingContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: theme.sizes.floatingContainer,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.light,
      elevation: 10,
      zIndex: 99,
    },
    progressContainer: {
      paddingBottom: theme.spacing.smd,
      paddingHorizontal: theme.spacing.xl,
      borderTopWidth: 2,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    progressText: {
      fontSize: 18,
      marginVertical: theme.spacing.sm,
      textAlign: 'center',
      color: theme.colors.text.primary,
    },
    progressTextCompleted: {
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    progressBarBg: {
      height: theme.sizes.progressBar,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xs,
    },
    progressBarFill: {
      height: theme.sizes.progressBar,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.xs,
    },
    completedTextDaily: {
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
  });

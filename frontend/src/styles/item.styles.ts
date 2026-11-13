import { StyleSheet } from 'react-native';
import { Theme } from '../theme/theme';

export const getStyles = (theme: Theme) =>
  StyleSheet.create({
    todoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      elevation: 1,
      overflow: 'hidden',
      position: 'relative',
    },
    checkbox: {
      width: theme.sizes.checkbox,
      height: theme.sizes.checkbox,
      borderRadius: theme.radius.sm,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      marginLeft: theme.spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checked: {
      backgroundColor: theme.colors.primary,
    },
    checkMark: {
      color: theme.colors.surface,
      fontSize: 14,
      fontWeight: 'bold',
    },
    todoText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text.primary,
      margin: theme.spacing.lg,
    },
    completedText: {
      textDecorationLine: 'line-through',
      color: theme.colors.text.muted,
    },
    deleteIcon: {
      fontSize: 20,
      marginLeft: theme.spacing.smd,
    },
    deleteBack: {
      backgroundColor: theme.colors.danger,
      justifyContent: 'center',
      alignItems: 'flex-start',
      height: '100%',
      paddingRight: 0,
      marginBottom: theme.spacing.md,
      paddingLeft: theme.spacing.smd,
      borderBottomLeftRadius: theme.radius.xl,
      borderTopLeftRadius: theme.radius.xl,
    },
  });

import { StyleSheet, Platform } from 'react-native';
import { Theme } from '../theme/theme';

export const getStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollContainer: {
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
      backgroundColor: theme.colors.background,
      ...Platform.select({
        web: {
          paddingTop: theme.spacing.xl,
          paddingHorizontal: theme.spacing.lg,
        },
      }),
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.smd,
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        android: {
          elevation: 1.5,
        },
        web: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        },
      }),
    },
    cardHeaderWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text.primary,
      marginLeft: theme.spacing.sm,
    },

    clockCenterContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xs,
    },

    compactClock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    compactClockGroup: {
      flexDirection: 'row',
      alignItems: 'stretch',
      height: 48,
    },
    clockValueBg: {
      backgroundColor: theme.colors.icon.bg,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      borderColor: theme.colors.icon.primary,
      minWidth: 56,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
    },
    clockValueLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 1,
    },
    clockValueText: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text.primary,
    },
    clockControlBtn: {
      width: 44,
      backgroundColor: theme.colors.icon.bg,
      borderWidth: 2,
      borderColor: theme.colors.icon.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clockControlBtnLeft: {
      borderTopLeftRadius: theme.radius.lg,
      borderBottomLeftRadius: theme.radius.lg,
    },
    clockControlBtnRight: {
      borderTopRightRadius: theme.radius.lg,
      borderBottomRightRadius: theme.radius.lg,
    },
    compactSeparator: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.icon.primary,
      marginHorizontal: theme.spacing.md,
      alignSelf: 'center',
    },

    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    profileInfo: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    profileTitle: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    profileUsername: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text.primary,
      marginTop: 1,
    },
    syncBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.xs,
    },
    pulseDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.xs,
      backgroundColor: '#10B981',
      marginRight: theme.spacing.sm,
    },
    syncText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#10B981',
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.icon.bg,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
    },
    logoutButtonText: {
      color: theme.colors.icon.primary,
      fontWeight: '700',
      fontSize: 12,
      marginLeft: theme.spacing.xs,
    },

    localProfileContainer: {
      flexDirection: 'column',
    },
    localProfileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    authButtonsRow: {
      flexDirection: 'row',
      marginTop: theme.spacing.sm,
    },
    primaryAuthButton: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.sm,
    },
    primaryAuthButtonText: {
      color: theme.colors.text.white,
      fontWeight: '700',
      fontSize: 13,
    },
    secondaryAuthButton: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryAuthButtonText: {
      color: theme.colors.text.secondary,
      fontWeight: '700',
      fontSize: 13,
    },

    authCard: {
      position: 'relative',
      paddingTop: theme.spacing.sm,
      overflow: 'hidden',
    },
    cornerBackButton: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 60,
      height: 48,
      backgroundColor: theme.colors.icon.bg,
      borderTopLeftRadius: theme.radius.lg,
      borderBottomRightRadius: theme.radius.lg,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    authTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text.primary,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.xxxl,
    },
    formContainer: {
      flexDirection: 'column',
    },
    authInput: {
      backgroundColor: theme.colors.surface,
      fontSize: 14,
      height: 48,
      marginBottom: theme.spacing.mdl,
    },
    submitAuthButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.smd,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.md,
    },
    submitAuthButtonText: {
      color: theme.colors.text.white,
      fontWeight: '700',
      fontSize: 14,
    },
    toggleAuthLink: {
      alignItems: 'center',
      marginTop: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    toggleAuthText: {
      color: theme.colors.primary,
      fontWeight: '700',
      fontSize: 13,
    },

    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
      padding: theme.spacing.xs,
      borderRadius: theme.radius.lg,
      marginTop: theme.spacing.sm,
    },
    segmentButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      marginHorizontal: theme.spacing.xs / 2,
    },
    segmentButtonActive: {
      backgroundColor: theme.colors.icon.bg,
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 2,
        },
        android: {
          elevation: 1,
        },
      }),
    },
    segmentText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing.xs,
    },
    segmentTextActive: {
      color: theme.colors.icon.primary,
    },

    subtabContainer: {
      marginTop: theme.spacing.smd,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.light,
      paddingTop: theme.spacing.smd,
    },

    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    switchTextContainer: {
      flex: 1,
    },
    shortcutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    shortcutInfo: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    shortcutTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text.primary,
    },
    shortcutKeysContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    keycap: {
      backgroundColor: theme.colors.icon.bg,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      minWidth: 24,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 1,
        },
        android: {
          elevation: 1,
        },
        web: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 1,
          cursor: 'pointer',
        },
      }),
    },
    keycapActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    keycapText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.icon.primary,
      fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    },
    keycapTextActive: {
      color: theme.colors.text.white,
    },
    shortcutResetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.icon.bg,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.smd,
      paddingHorizontal: theme.spacing.md,
      marginTop: theme.spacing.md,
      alignSelf: 'stretch',
    },
    shortcutResetButtonText: {
      color: theme.colors.text.secondary,
      fontWeight: '700',
      fontSize: 13,
      marginLeft: theme.spacing.xs,
    },
  });

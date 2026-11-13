import { StyleSheet } from 'react-native';
import { Theme } from '../theme/theme';

export const getStyles = (theme: Theme) =>
  StyleSheet.create({
    backgroundContainer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.surface,
      zIndex: -1,
      marginRight: theme.sizes.floatingContainer,
    },
    backgroundBar: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
    },
    divider: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: theme.colors.primary + '1A',
    },
    fill: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.primaryLight,
    },
    grid: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
    },
    segment: {
      flex: 1,
      height: 18,
      borderRightWidth: 1,
      borderRightColor: theme.colors.primary + '66',
    },
  });

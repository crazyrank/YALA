import { Platform } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

// Cross-platform shadow presets. Spread these into a style object.
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#0A1930',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 4 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: '#0A1930',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    android: { elevation: 2 },
    default: {},
  }),
  button: Platform.select({
    ios: {
      shadowColor: '#0A1930',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
    },
    android: { elevation: 6 },
    default: {},
  }),
  goldGlow: Platform.select({
    ios: {
      shadowColor: '#C9A24B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
    },
    android: { elevation: 5 },
    default: {},
  }),
};

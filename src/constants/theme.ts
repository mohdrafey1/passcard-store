import { StyleSheet, Platform } from 'react-native';

export const Colors = {
  background: '#0A0E1A',
  surface: '#141929',
  surfaceElevated: '#1C2237',
  surfacePressed: '#252D47',
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  primaryDark: '#5A4BD1',
  secondary: '#00CEC9',
  secondaryLight: '#55EFC4',
  success: '#00B894',
  warning: '#FDCB6E',
  danger: '#FF6B6B',
  dangerDark: '#E55555',
  text: '#EAEAEA',
  textSecondary: '#8892B0',
  textMuted: '#5A6380',
  border: '#2D3555',
  borderLight: '#3D4565',
  inputBackground: '#1A2035',
  overlay: 'rgba(0, 0, 0, 0.6)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  // Password strength colors
  strengthWeak: '#FF6B6B',
  strengthFair: '#FDCB6E',
  strengthGood: '#00CEC9',
  strengthStrong: '#00B894',
  // Card gradient
  cardGradientStart: '#1E2745',
  cardGradientEnd: '#141929',
  // Category colors
  categorySocial: '#6C5CE7',
  categoryBanking: '#00CEC9',
  categoryWork: '#FDCB6E',
  categoryPersonal: '#FF6B6B',
  categoryShopping: '#55EFC4',
  categoryEntertainment: '#A29BFE',
  categoryEducation: '#74B9FF',
  categoryOther: '#8892B0',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 40,
};

export const FontFamily = {
  regular: Platform.select({ android: 'sans-serif', default: 'System' }),
  medium: Platform.select({ android: 'sans-serif-medium', default: 'System' }),
  bold: Platform.select({ android: 'sans-serif-medium', default: 'System' }),
  mono: Platform.select({ android: 'monospace', default: 'Courier' }),
};

export const Shadow = StyleSheet.create({
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
});

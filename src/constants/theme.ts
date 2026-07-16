import { StyleSheet, Platform } from 'react-native';

export const Colors = {
  background: '#F6F2EB',
  surface: '#FFFFFF',
  surfaceElevated: '#FFF9F0',
  surfacePressed: '#F0E8DB',
  primary: '#D89A1C',
  primaryLight: '#F0C14B',
  primaryDark: '#B07E15',
  secondary: '#1F1712',
  secondaryLight: '#3D2E22',
  success: '#4D8B31',
  warning: '#F4B740',
  danger: '#E74C3C',
  dangerDark: '#C0392B',
  text: '#1F1712',
  textSecondary: '#6B5D4F',
  // Darkened from #A0927F to meet WCAG AA contrast for hint/placeholder text
  // on the light background.
  textMuted: '#7C6E5B',
  border: '#E5DDD0',
  borderLight: '#EDE7DC',
  inputBackground: '#FFFFFF',
  overlay: 'rgba(31, 23, 18, 0.5)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  // Password strength colors
  strengthWeak: '#E74C3C',
  strengthFair: '#F4B740',
  strengthGood: '#D89A1C',
  strengthStrong: '#4D8B31',
  // Card gradient
  cardGradientStart: '#1F1712',
  cardGradientEnd: '#3D2E22',
  // Category colors
  categorySocial: '#D89A1C',
  categoryBanking: '#4D8B31',
  categoryWork: '#F4B740',
  categoryPersonal: '#E74C3C',
  categoryShopping: '#B07E15',
  categoryEntertainment: '#F0C14B',
  categoryEducation: '#6B5D4F',
  categoryOther: '#A0927F',
};

// Credit-card widget gradient (dark → darker) kept here so every card renders
// from the same source of truth.
export const CardGradient: [string, string, string] = ['#3D2E22', '#1F1712', '#130E0A'];

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

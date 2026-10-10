import type { TextStyle } from 'react-native';

/**
 * Fonts are embedded at build time by the expo-font config plugin (app.json),
 * registered on Android as font families with weights, so `fontWeight` picks
 * the right file.
 */
export const FONT = 'Manrope';
export const MONO = 'JetBrains Mono';

export const type = {
  display: { fontFamily: FONT, fontWeight: '800', fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontFamily: FONT, fontWeight: '800', fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  headline: { fontFamily: FONT, fontWeight: '700', fontSize: 18, lineHeight: 24 },
  body: { fontFamily: FONT, fontWeight: '500', fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: FONT, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  label: { fontFamily: FONT, fontWeight: '700', fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: FONT, fontWeight: '600', fontSize: 13, lineHeight: 18 },
  overline: {
    fontFamily: FONT,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  small: { fontFamily: FONT, fontWeight: '800', fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: MONO, fontWeight: '500', fontSize: 17, lineHeight: 24, letterSpacing: 0.4 },
  monoLarge: { fontFamily: MONO, fontWeight: '600', fontSize: 21, lineHeight: 29, letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

export const radius = { chip: 10, field: 14, row: 16, group: 20, sheet: 28, pill: 999 } as const;

/** Minimum touch target (dp). */
export const TOUCH = 48;

import type { CardColor } from '@/types/card';

/**
 * Midnight Brass. Two palettes, one set of roles. Text pairs are checked
 * against WCAG AA (4.5:1 body, 3:1 for large text and icons):
 *   Midnight  ink 16.4, ink2 9.9, muted 5.9, brass 9.6, onBrass 9.4
 *   Paper     ink 16.3, ink2 6.9, muted 4.5, brassText 5.9, onBrass 9.4
 */
export interface Palette {
  isDark: boolean;
  ground: string;
  surface: string;
  raised: string;
  line: string;
  divider: string;
  ink: string;
  ink2: string;
  muted: string;
  brass: string;
  onBrass: string;
  /** Brass used as text/icon colour on ground or surface. */
  brassText: string;
  brassSoft: string;
  success: string;
  successSoft: string;
  warn: string;
  warnSoft: string;
  warnLine: string;
  /** Body text on warnSoft. */
  warnInk: string;
  /** Emphasis text (and icons) on warnSoft. */
  warnText: string;
  danger: string;
  dangerSoft: string;
  dangerLine: string;
  info: string;
  scrim: string;
  toastBg: string;
  toastInk: string;
  toastMuted: string;
  dotEmpty: string;
  statusBar: 'light' | 'dark';
}

export const midnight: Palette = {
  isDark: true,
  ground: '#0B1120',
  surface: '#131B2E',
  raised: '#1B2540',
  line: '#263252',
  divider: '#172036',
  ink: '#F3EFE7',
  ink2: '#B4BCCD',
  muted: '#8590A8',
  brass: '#E6B04A',
  onBrass: '#1A1305',
  brassText: '#E6B04A',
  brassSoft: '#3A2E14',
  success: '#6FD08C',
  successSoft: '#15301F',
  warn: '#FFB067',
  warnSoft: '#2A2013',
  warnLine: '#4A3618',
  warnInk: '#E9D9C4',
  warnText: '#FFB067',
  danger: '#FF7A70',
  dangerSoft: '#2A1519',
  dangerLine: '#5A2A2C',
  info: '#8AB4FF',
  scrim: 'rgba(5, 8, 15, 0.72)',
  toastBg: '#F3EFE7',
  toastInk: '#0B1120',
  toastMuted: '#4A5468',
  dotEmpty: '#3A4870',
  statusBar: 'light',
};

export const paper: Palette = {
  isDark: false,
  ground: '#F6F4EF',
  surface: '#FFFFFF',
  raised: '#EFEBE3',
  line: '#E2DCCF',
  divider: '#ECE7DD',
  ink: '#0F1729',
  ink2: '#4A5468',
  muted: '#667085',
  brass: '#E6B04A',
  onBrass: '#1A1305',
  brassText: '#8A5A00',
  brassSoft: '#FBEBC8',
  success: '#2E7D4B',
  successSoft: '#DDF2E3',
  warn: '#B35C00',
  warnSoft: '#FCEBD9',
  warnLine: '#F2D2B0',
  warnInk: '#5C3A10',
  warnText: '#8F4A00',
  danger: '#C0362C',
  dangerSoft: '#FBE7E4',
  dangerLine: '#F2C4BE',
  info: '#2F5FD0',
  scrim: 'rgba(15, 23, 41, 0.45)',
  toastBg: '#0F1729',
  toastInk: '#F6F4EF',
  toastMuted: '#B4BCCD',
  dotEmpty: '#C9C2B3',
  statusBar: 'dark',
};

/** Letter tiles; the hue is picked from the item name so it stays stable. */
export const MONOGRAMS: Record<'dark' | 'light', [bg: string, fg: string][]> = {
  dark: [
    ['#1E3A6E', '#A9C4FF'],
    ['#123F44', '#7FD6CF'],
    ['#163C26', '#8BDDA6'],
    ['#4A3410', '#F2C14E'],
    ['#4A1C22', '#FF9A9A'],
    ['#2F2550', '#C3B4FF'],
    ['#26324F', '#C9D3E6'],
  ],
  light: [
    ['#DCE7FF', '#1D3F8F'],
    ['#D5F0EE', '#0F5A55'],
    ['#DDF2E3', '#1E6337'],
    ['#FBEBC8', '#7A5200'],
    ['#FBE0DE', '#9B2C25'],
    ['#E8E2FF', '#4B3A9C'],
    ['#E3E8F1', '#33405C'],
  ],
};

/** Card faces look the same in both themes (they are objects, not UI). */
export const CARD_FACES: Record<CardColor, { bg: string; line: string; ink: string; label: string; name: string }> = {
  navy: { bg: '#1B2A4F', line: '#2C3E6B', ink: '#F3EFE7', label: '#AEB8CF', name: 'Navy' },
  plum: { bg: '#3A2340', line: '#4E3255', ink: '#F3EFE7', label: '#C7B3CC', name: 'Plum' },
  slate: { bg: '#2B3442', line: '#3C4658', ink: '#F3EFE7', label: '#B3BCC9', name: 'Slate' },
  teal: { bg: '#123F44', line: '#1D555B', ink: '#F3EFE7', label: '#A6D4D0', name: 'Teal' },
  forest: { bg: '#163C26', line: '#24533A', ink: '#F3EFE7', label: '#A9D8B8', name: 'Forest' },
  brass: { bg: '#C9963A', line: '#B5832C', ink: '#1A1305', label: '#3B2A0A', name: 'Brass' },
};

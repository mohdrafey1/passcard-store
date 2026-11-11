import type { PasswordCategory } from '@/types/password';

export const DEFAULT_CATEGORIES: PasswordCategory[] = [
  'Social',
  'Banking',
  'Work',
  'Personal',
  'Shopping',
  'Entertainment',
  'Education',
  'Other',
];

export const CATEGORY_ICONS: Record<PasswordCategory, string> = {
  Social: '👥',
  Banking: '🏦',
  Work: '💼',
  Personal: '🔒',
  Shopping: '🛒',
  Entertainment: '🎮',
  Education: '📚',
  Other: '📌',
};

// Accent colour per category, used to tint list rows and badges.
export const CATEGORY_COLORS: Record<PasswordCategory, string> = {
  Social: '#D89A1C',
  Banking: '#4D8B31',
  Work: '#E08A2B',
  Personal: '#C0562E',
  Shopping: '#B07E15',
  Entertainment: '#8E6BC9',
  Education: '#3B7FB0',
  Other: '#7C6E5B',
};


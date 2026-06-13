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

import { DEFAULT_CATEGORIES } from '@/types/settings';

export { DEFAULT_CATEGORIES };

const CATEGORY_ICONS: Record<string, string> = {
  Social: '👥',
  Banking: '🏦',
  Work: '💼',
  Personal: '🔒',
  Shopping: '🛒',
  Entertainment: '🎮',
  Education: '📚',
  Other: '📌',
};

export function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '📌';
}

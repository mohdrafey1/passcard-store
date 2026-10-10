import type { CardEntry } from '@/types/card';
import type { PasswordEntry } from '@/types/password';
import { detectNetwork, maskCardNumber } from '@/utils/cards';

/** Logins and cards in one list (Vault home, search, Recently deleted). */
export type VaultItem =
  | { kind: 'login'; id: string; title: string; subtitle: string; entry: PasswordEntry }
  | { kind: 'card'; id: string; title: string; subtitle: string; entry: CardEntry };

export type SortMode = 'name' | 'used' | 'added';

export const SORT_LABELS: Record<SortMode, string> = {
  name: 'Name',
  used: 'Recently used',
  added: 'Recently added',
};

/** 'all' | 'favorites' | 'logins' | 'cards' | 'category:<name>' */
export type VaultFilter = 'all' | 'favorites' | 'logins' | 'cards' | `category:${string}`;

export function loginItem(p: PasswordEntry): VaultItem {
  return { kind: 'login', id: p.id, title: p.title || 'Untitled', subtitle: p.username || p.email || p.website, entry: p };
}

export function cardItem(c: CardEntry): VaultItem {
  const network = detectNetwork(c.cardNumber);
  const name = network.id === 'unknown' ? 'Card' : network.name;
  return { kind: 'card', id: c.id, title: c.cardNickname || name, subtitle: `${name} ${maskCardNumber(c.cardNumber)}`, entry: c };
}

export function toItems(passwords: PasswordEntry[], cards: CardEntry[]): VaultItem[] {
  return [...passwords.map(loginItem), ...cards.map(cardItem)];
}

function haystack(item: VaultItem): string {
  if (item.kind === 'login') {
    const p = item.entry;
    return [p.title, p.website, p.username, p.email, p.category, p.notes].join('\n').toLowerCase();
  }
  const c = item.entry;
  return [c.cardNickname, c.cardHolderName, c.cardNumber.slice(-4), detectNetwork(c.cardNumber).name, c.notes].join('\n').toLowerCase();
}

export function filterItems(items: VaultItem[], query: string, filter: VaultFilter): VaultItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter === 'favorites' && !item.entry.favorite) return false;
    if (filter === 'logins' && item.kind !== 'login') return false;
    if (filter === 'cards' && item.kind !== 'card') return false;
    if (filter.startsWith('category:')) {
      if (item.kind !== 'login' || item.entry.category !== filter.slice('category:'.length)) return false;
    }
    return !q || haystack(item).includes(q);
  });
}

export function sortItems(items: VaultItem[], mode: SortMode): VaultItem[] {
  const sorted = [...items];
  if (mode === 'name') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  } else if (mode === 'used') {
    const used = (i: VaultItem) => i.entry.lastUsedAt ?? '';
    sorted.sort((a, b) => used(b).localeCompare(used(a)) || a.title.localeCompare(b.title));
  } else {
    sorted.sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
  }
  return sorted;
}

/** Days since an ISO date, or null. */
export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 86_400_000);
}

/** "today", "yesterday", "3 days ago", "2 months ago", "1 year ago" */
/** "1 login", "3 logins". */
export function counted(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

export function relativeAge(iso: string | null, now: Date = new Date()): string {
  const d = daysSince(iso, now);
  if (d === null) return '';
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  const months = Math.floor(d / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(d / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Whether to nudge for a backup, given the reminder setting. */
export function backupNudge(
  lastBackupAt: string | null,
  reminderDays: number | null,
  itemCount: number,
  now: Date = new Date(),
): { due: boolean; days: number | null } {
  const days = daysSince(lastBackupAt, now);
  if (reminderDays === null || itemCount === 0) return { due: false, days };
  return { due: days === null || days >= reminderDays, days };
}

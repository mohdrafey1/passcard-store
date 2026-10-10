import { normalizeCard } from '@/types/card';
import { normalizePassword } from '@/types/password';
import { backupNudge, filterItems, relativeAge, sortItems, toItems } from '../items';

const login = (o: Record<string, unknown>) => normalizePassword({ id: String(o.title), ...o })!;
const card = (o: Record<string, unknown>) => normalizeCard({ id: String(o.cardNickname), ...o })!;

const items = toItems(
  [
    login({
      title: 'GitHub',
      username: 'alex',
      category: 'Work',
      favorite: true,
      createdAt: '2026-01-01T00:00:00Z',
      lastUsedAt: '2026-10-01T00:00:00Z',
    }),
    login({ title: 'amazon', email: 'a@x.com', category: 'Shopping', createdAt: '2026-05-01T00:00:00Z' }),
    login({
      title: 'Netflix',
      notes: 'family plan',
      category: 'Personal',
      createdAt: '2026-03-01T00:00:00Z',
      lastUsedAt: '2026-09-01T00:00:00Z',
    }),
  ],
  [card({ cardNickname: 'Regalia', cardNumber: '4111111111114471', createdAt: '2026-08-01T00:00:00Z' })],
);

describe('filterItems', () => {
  it('searches across fields, notes and the card’s last four digits', () => {
    expect(filterItems(items, 'git', 'all').map((i) => i.title)).toEqual(['GitHub']);
    expect(filterItems(items, 'family', 'all').map((i) => i.title)).toEqual(['Netflix']);
    expect(filterItems(items, '4471', 'all').map((i) => i.title)).toEqual(['Regalia']);
    expect(filterItems(items, 'visa', 'all').map((i) => i.title)).toEqual(['Regalia']);
  });

  it('filters by kind, favourite and category', () => {
    expect(filterItems(items, '', 'cards')).toHaveLength(1);
    expect(filterItems(items, '', 'logins')).toHaveLength(3);
    expect(filterItems(items, '', 'favorites').map((i) => i.title)).toEqual(['GitHub']);
    expect(filterItems(items, '', 'category:Work').map((i) => i.title)).toEqual(['GitHub']);
  });
});

describe('sortItems', () => {
  it('sorts by name ignoring case', () => {
    expect(sortItems(items, 'name').map((i) => i.title)).toEqual(['amazon', 'GitHub', 'Netflix', 'Regalia']);
  });
  it('puts recently used first, never-used last', () => {
    expect(
      sortItems(items, 'used')
        .map((i) => i.title)
        .slice(0, 2),
    ).toEqual(['GitHub', 'Netflix']);
  });
  it('puts recently added first', () => {
    expect(sortItems(items, 'added')[0].title).toBe('Regalia');
  });
});

describe('relativeAge', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  it.each([
    ['2026-10-10T08:00:00Z', 'today'],
    ['2026-10-09T08:00:00Z', 'yesterday'],
    ['2026-10-01T08:00:00Z', '9 days ago'],
    ['2026-07-01T08:00:00Z', '3 months ago'],
    ['2024-09-01T08:00:00Z', '2 years ago'],
  ])('%s → %s', (iso, text) => expect(relativeAge(iso, now)).toBe(text));
});

describe('backupNudge', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  it('nudges when never backed up and there is something to lose', () => {
    expect(backupNudge(null, 30, 3, now)).toEqual({ due: true, days: null });
    expect(backupNudge(null, 30, 0, now).due).toBe(false);
  });
  it('nudges after the reminder interval', () => {
    expect(backupNudge('2026-09-01T00:00:00Z', 30, 3, now).due).toBe(true);
    expect(backupNudge('2026-10-01T00:00:00Z', 30, 3, now).due).toBe(false);
  });
  it('never nudges when reminders are off', () => {
    expect(backupNudge(null, null, 3, now).due).toBe(false);
  });
});

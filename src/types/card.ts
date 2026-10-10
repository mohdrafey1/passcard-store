export const CARD_COLORS = ['navy', 'plum', 'slate', 'teal', 'forest', 'brass'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export interface CardEntry {
  id: string;
  cardHolderName: string;
  /** Digits only. */
  cardNumber: string;
  /** "01"–"12". */
  expiryMonth: string;
  /** Two digits, e.g. "29". */
  expiryYear: string;
  cvv: string;
  cardNickname: string;
  notes: string;
  color: CardColor;
  favorite: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CardFormData = Omit<CardEntry, 'id' | 'createdAt' | 'updatedAt'>;

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const isoOrNull = (v: unknown): string | null =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;

/** Coerce a stored, restored or imported card into a complete entry. */
export function normalizeCard(raw: unknown): CardEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const now = new Date().toISOString();
  const createdAt = isoOrNull(r.createdAt) ?? now;
  const color = CARD_COLORS.includes(r.color as CardColor) ? (r.color as CardColor) : 'navy';
  return {
    id: r.id,
    cardHolderName: str(r.cardHolderName),
    cardNumber: str(r.cardNumber).replace(/\D/g, ''),
    expiryMonth: str(r.expiryMonth),
    expiryYear: str(r.expiryYear),
    cvv: str(r.cvv),
    cardNickname: str(r.cardNickname),
    notes: str(r.notes),
    color,
    favorite: r.favorite === true,
    lastUsedAt: isoOrNull(r.lastUsedAt),
    createdAt,
    updatedAt: isoOrNull(r.updatedAt) ?? createdAt,
  };
}

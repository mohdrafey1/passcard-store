export interface PasswordEntry {
  id: string;
  title: string;
  website: string;
  username: string;
  email: string;
  password: string;
  notes: string;
  /** Free text; the user's category list lives in settings. */
  category: string;
  favorite: boolean;
  /** Set when a secret from this login is copied. */
  lastUsedAt: string | null;
  /** Set when the password itself changes (not other fields). */
  passwordChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PasswordFormData = Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>;

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const isoOrNull = (v: unknown): string | null =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;

/**
 * Coerce anything read from storage, a backup or an import into a complete
 * entry. Older records lack the v1.3 fields; anything without an id is
 * rejected.
 */
export function normalizePassword(raw: unknown): PasswordEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const now = new Date().toISOString();
  const createdAt = isoOrNull(r.createdAt) ?? now;
  return {
    id: r.id,
    title: str(r.title),
    website: str(r.website),
    username: str(r.username),
    email: str(r.email),
    password: str(r.password),
    notes: str(r.notes),
    category: str(r.category) || 'Other',
    favorite: r.favorite === true,
    lastUsedAt: isoOrNull(r.lastUsedAt),
    passwordChangedAt: isoOrNull(r.passwordChangedAt),
    createdAt,
    updatedAt: isoOrNull(r.updatedAt) ?? createdAt,
  };
}

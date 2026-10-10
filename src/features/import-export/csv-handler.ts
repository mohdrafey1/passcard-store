import * as ExpoCrypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import { cardRepository } from '@/storage/card-repository';
import { passwordRepository } from '@/storage/password-repository';
import type { CardEntry } from '@/types/card';
import type { PasswordEntry } from '@/types/password';
import { runWithoutAutoLock } from '@/utils/auto-lock-guard';
import { cleanupTempFile } from '@/utils/cache';
import { loginKey, type ImportProblem, type ParsedImport } from './import-formats';

// ---- Export (plain CSV; the UI warns that it isn't encrypted) ----

export function exportPasswordsToCSV(passwords: PasswordEntry[]): string {
  const rows = passwords.map((p) => ({
    title: p.title,
    website: p.website,
    username: p.username,
    email: p.email,
    password: p.password,
    notes: p.notes,
    category: p.category,
  }));
  // escapeFormulae: a value like =HYPERLINK(...) must stay text in a spreadsheet.
  return Papa.unparse(rows, { escapeFormulae: true });
}

export function exportCardsToCSV(cards: CardEntry[]): string {
  const rows = cards.map((c) => ({
    cardNickname: c.cardNickname,
    cardHolderName: c.cardHolderName,
    cardNumber: c.cardNumber,
    expiryMonth: c.expiryMonth,
    expiryYear: c.expiryYear,
    cvv: c.cvv,
    notes: c.notes,
  }));
  return Papa.unparse(rows, { escapeFormulae: true });
}

/** Write to cache, hand to the share sheet, then delete the plaintext file. */
export async function exportAndShareCSV(csvContent: string, filename: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.write(csvContent);
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await runWithoutAutoLock(() => Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: `Export ${filename}` }));
  } finally {
    cleanupTempFile(file.uri);
  }
}

// ---- Save a parsed import ----

export interface ImportOutcome {
  logins: number;
  cards: number;
  /** Already in the vault (same name, user and password / same card number). */
  duplicates: number;
  /** Notes, identities and other non-login rows that were left out. */
  skipped: number;
  problems: ImportProblem[];
}

export async function saveImport(parsed: ParsedImport): Promise<ImportOutcome> {
  const [existingLogins, existingCards] = await Promise.all([passwordRepository.findAll(), cardRepository.findAll()]);
  const seenLogins = new Set(existingLogins.map(loginKey));
  const seenCards = new Set(existingCards.map((c) => c.cardNumber));
  const now = new Date().toISOString();
  let duplicates = 0;

  const logins: PasswordEntry[] = [];
  for (const d of parsed.logins) {
    const key = loginKey(d);
    if (seenLogins.has(key)) {
      duplicates++;
      continue;
    }
    seenLogins.add(key);
    logins.push({ ...d, id: ExpoCrypto.randomUUID(), lastUsedAt: null, passwordChangedAt: null, createdAt: now, updatedAt: now });
  }

  const cards: CardEntry[] = [];
  for (const d of parsed.cards) {
    if (seenCards.has(d.cardNumber)) {
      duplicates++;
      continue;
    }
    seenCards.add(d.cardNumber);
    cards.push({ ...d, id: ExpoCrypto.randomUUID(), color: 'navy', favorite: false, lastUsedAt: null, createdAt: now, updatedAt: now });
  }

  if (logins.length) await passwordRepository.upsertMany(logins);
  if (cards.length) await cardRepository.upsertMany(cards);
  return { logins: logins.length, cards: cards.length, duplicates, skipped: parsed.skipped, problems: parsed.problems };
}

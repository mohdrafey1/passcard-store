import Papa from 'papaparse';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { PasswordEntry } from '@/types/password';
import type { CardEntry } from '@/types/card';
import { passwordRepository } from '@/storage/password-repository';
import { cardRepository } from '@/storage/card-repository';
import { cleanupTempFile } from '@/utils/cache';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import * as ExpoCrypto from 'expo-crypto';

const VALID_CATEGORIES = new Set<string>(DEFAULT_CATEGORIES);

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// ---- EXPORT ----

/**
 * Export passwords to CSV string
 */
export function exportPasswordsToCSV(passwords: PasswordEntry[]): string {
  const data = passwords.map((p) => ({
    title: p.title,
    website: p.website,
    username: p.username,
    email: p.email,
    password: p.password,
    notes: p.notes,
    category: p.category,
  }));
  return Papa.unparse(data);
}

/**
 * Export cards to CSV string
 */
export function exportCardsToCSV(cards: CardEntry[]): string {
  const data = cards.map((c) => ({
    cardNickname: c.cardNickname,
    cardHolderName: c.cardHolderName,
    cardNumber: c.cardNumber,
    expiryMonth: c.expiryMonth,
    expiryYear: c.expiryYear,
    cvv: c.cvv,
    notes: c.notes,
  }));
  return Papa.unparse(data);
}

/**
 * Save CSV to file and share
 */
export async function exportAndShareCSV(csvContent: string, filename: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.write(csvContent);

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    try {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${filename}`,
      });
    } finally {
      // Exported CSV is unencrypted plaintext — remove it from cache once shared.
      cleanupTempFile(file.uri);
    }
  } else {
    cleanupTempFile(file.uri);
  }
}

// ---- IMPORT ----

const REQUIRED_PASSWORD_FIELDS = ['title', 'email', 'password'];
const REQUIRED_CARD_FIELDS = ['cardHolderName', 'cardNumber', 'expiryMonth', 'expiryYear', 'cvv'];

/**
 * Import passwords from CSV string
 */
export async function importPasswordsFromCSV(csvContent: string): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, errors: [] };

  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    result.errors.push(...parsed.errors.map((e) => `Row ${e.row}: ${e.message}`));
  }

  // Validate required columns exist
  const headers = parsed.meta.fields || [];
  const missingFields = REQUIRED_PASSWORD_FIELDS.filter((f) => !headers.includes(f));
  if (missingFields.length > 0) {
    result.errors.push(`Missing required columns: ${missingFields.join(', ')}`);
    result.failed = parsed.data.length;
    return result;
  }

  // Get existing passwords for duplicate detection
  const existing = await passwordRepository.findAll();
  const existingKeys = new Set(
    existing.map((p) => `${p.title.toLowerCase()}:${p.email.toLowerCase()}`),
  );

  const toImport: PasswordEntry[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, string>;
    try {
      const title = (row.title || '').trim();
      const email = (row.email || '').trim();
      const password = (row.password || '').trim();

      if (!title || !password) {
        result.failed++;
        result.errors.push(`Row ${i + 1}: Missing title or password`);
        continue;
      }

      // Check for duplicates
      const key = `${title.toLowerCase()}:${email.toLowerCase()}`;
      if (existingKeys.has(key)) {
        result.skipped++;
        continue;
      }

      const rawCategory = (row.category || 'Other').trim();
      // Guard against arbitrary category strings that would break the filter
      // pills and category icons.
      const category = (VALID_CATEGORIES.has(rawCategory)
        ? rawCategory
        : 'Other') as PasswordEntry['category'];

      const now = new Date().toISOString();
      toImport.push({
        id: ExpoCrypto.randomUUID(),
        title,
        website: (row.website || '').trim(),
        username: (row.username || '').trim(),
        email,
        password,
        notes: (row.notes || '').trim(),
        category,
        createdAt: now,
        updatedAt: now,
      });

      existingKeys.add(key);
    } catch {
      result.failed++;
      result.errors.push(`Row ${i + 1}: Parse error`);
    }
  }

  if (toImport.length > 0) {
    await passwordRepository.bulkCreate(toImport);
    result.imported = toImport.length;
  }

  return result;
}

/**
 * Import cards from CSV string
 */
export async function importCardsFromCSV(csvContent: string): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, errors: [] };

  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    result.errors.push(...parsed.errors.map((e) => `Row ${e.row}: ${e.message}`));
  }

  const headers = parsed.meta.fields || [];
  const missingFields = REQUIRED_CARD_FIELDS.filter((f) => !headers.includes(f));
  if (missingFields.length > 0) {
    result.errors.push(`Missing required columns: ${missingFields.join(', ')}`);
    result.failed = parsed.data.length;
    return result;
  }

  const existing = await cardRepository.findAll();
  const existingCards = new Set(existing.map((c) => c.cardNumber));

  const toImport: CardEntry[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, string>;
    try {
      const cardNumber = (row.cardNumber || '').trim().replace(/\s/g, '');
      const cardHolderName = (row.cardHolderName || '').trim();

      if (!cardNumber || !cardHolderName) {
        result.failed++;
        result.errors.push(`Row ${i + 1}: Missing card number or holder name`);
        continue;
      }

      if (existingCards.has(cardNumber)) {
        result.skipped++;
        continue;
      }

      const now = new Date().toISOString();
      toImport.push({
        id: ExpoCrypto.randomUUID(),
        cardHolderName,
        cardNumber,
        expiryMonth: (row.expiryMonth || '').trim(),
        expiryYear: (row.expiryYear || '').trim(),
        cvv: (row.cvv || '').trim(),
        cardNickname: (row.cardNickname || '').trim(),
        notes: (row.notes || '').trim(),
        createdAt: now,
        updatedAt: now,
      });

      existingCards.add(cardNumber);
    } catch {
      result.failed++;
      result.errors.push(`Row ${i + 1}: Parse error`);
    }
  }

  if (toImport.length > 0) {
    await cardRepository.bulkCreate(toImport);
    result.imported = toImport.length;
  }

  return result;
}

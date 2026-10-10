import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { importAeadKey, open, seal } from '@/security/aead';
import { base64ToBytes, bytesToBase64, utf8Decode, utf8Encode, wipeBytes } from '@/security/bytes';
import { createKdfParams, deriveKey, isKdfParams, type KdfParams } from '@/security/kdf';
import { legacyDecryptBackup } from '@/security/legacy';
import { cardRepository } from '@/storage/card-repository';
import { getDatabase } from '@/storage/database';
import { passwordRepository } from '@/storage/password-repository';
import { sanitizeCategories } from '@/storage/settings-storage';
import { normalizeCard, type CardEntry } from '@/types/card';
import { normalizePassword, type PasswordEntry } from '@/types/password';
import { runWithoutAutoLock } from '@/utils/auto-lock-guard';
import { cleanupTempFile } from '@/utils/cache';

/**
 * Encrypted backups.
 *
 * File (`.pcbackup`, JSON text):
 *   {"format":"passcard-backup","v":5,"kdf":{...},"data":"<base64 iv|ct|tag>"}
 * The payload is sealed with AES-256-GCM under a key derived (Argon2id) from a
 * backup password chosen by the user — never the vault PIN, so a leaked file
 * can't be opened by trying a million PINs. The derived key is kept in
 * SecureStore so making a backup doesn't require retyping the password.
 *
 * Files from v1.0–v1.1 (encrypted with the vault PIN) can still be restored.
 */

export const BACKUP_EXTENSION = '.pcbackup';
const FORMAT = 'passcard-backup';
const FORMAT_VERSION = 5;
const PAYLOAD_AAD = 'passcard:backup:v5';
const MAGIC = 'PASSCARD_VAULT';
const BACKUP_KEY = 'BACKUP_KEY_V1';
export const MIN_BACKUP_PASSWORD_LENGTH = 12;

export interface BackupPayload {
  magic: string;
  version: number;
  timestamp: string;
  passwords: PasswordEntry[];
  cards: CardEntry[];
  settings?: {
    autoLockDuration?: number;
    clipboardClearDuration?: number;
    categories?: string[];
  };
}

interface StoredBackupKey {
  kdf: KdfParams;
  key: string;
}

interface BackupFile {
  format: string;
  v: number;
  kdf: KdfParams;
  data: string;
}

// ---- Backup password ----

export async function hasBackupPassword(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BACKUP_KEY)) !== null;
}

export async function setBackupPassword(password: string): Promise<void> {
  if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${MIN_BACKUP_PASSWORD_LENGTH} characters.`);
  }
  const kdf = await createKdfParams();
  const key = await deriveKey(password, kdf);
  const stored: StoredBackupKey = { kdf, key: bytesToBase64(key) };
  wipeBytes(key);
  await SecureStore.setItemAsync(BACKUP_KEY, JSON.stringify(stored));
}

export async function clearBackupPassword(): Promise<void> {
  await SecureStore.deleteItemAsync(BACKUP_KEY).catch(() => {});
}

async function readBackupKey(): Promise<StoredBackupKey> {
  const raw = await SecureStore.getItemAsync(BACKUP_KEY);
  if (!raw) throw new Error('Set a backup password first.');
  const parsed = JSON.parse(raw) as StoredBackupKey;
  if (!isKdfParams(parsed.kdf) || typeof parsed.key !== 'string') throw new Error('Set a backup password again.');
  return parsed;
}

// ---- Create ----

export interface BuiltBackup {
  filename: string;
  content: string;
  passwords: number;
  cards: number;
}

export async function buildBackup(settings: BackupPayload['settings']): Promise<BuiltBackup> {
  const stored = await readBackupKey();
  const [passwords, cards] = await Promise.all([passwordRepository.findAll(), cardRepository.findAll()]);
  const payload: BackupPayload = {
    magic: MAGIC,
    version: 2,
    timestamp: new Date().toISOString(),
    passwords,
    cards,
    settings,
  };
  const keyBytes = base64ToBytes(stored.key);
  const key = await importAeadKey(keyBytes);
  wipeBytes(keyBytes);
  const file: BackupFile = {
    format: FORMAT,
    v: FORMAT_VERSION,
    kdf: stored.kdf,
    data: await seal(key, utf8Encode(JSON.stringify(payload)), PAYLOAD_AAD),
  };
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `passcard-backup-${date}${BACKUP_EXTENSION}`,
    content: JSON.stringify(file),
    passwords: passwords.length,
    cards: cards.length,
  };
}

/**
 * Save into a folder the user picks (Storage Access Framework). Returns false
 * if they backed out of the picker; any other failure throws.
 */
export async function saveBackupToFolder(backup: BuiltBackup): Promise<boolean> {
  let dir: Directory;
  try {
    dir = await runWithoutAutoLock(() => Directory.pickDirectoryAsync());
  } catch {
    return false;
  }
  const file = dir.createFile(backup.filename, 'application/octet-stream');
  file.write(backup.content);
  return true;
}

/** Hand the file to the share sheet (Drive, email, another app). */
export async function shareBackup(backup: BuiltBackup): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  const file = new File(Paths.cache, backup.filename);
  file.write(backup.content);
  try {
    await runWithoutAutoLock(() =>
      Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Save Passcard backup' }),
    );
  } finally {
    // Encrypted, but there's no reason to keep a copy in the cache.
    cleanupTempFile(file.uri);
  }
}

// ---- Restore ----

export type BackupKind = 'current' | 'legacy' | 'unknown';

/** Current files ask for the backup password; older ones for the PIN used then. */
export function detectBackupKind(content: string): BackupKind {
  const text = content.trim();
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as Partial<BackupFile>;
      return parsed.format === FORMAT ? 'current' : 'unknown';
    } catch {
      return 'unknown';
    }
  }
  return /^[0-9a-f]{32}:/i.test(text) ? 'legacy' : 'unknown';
}

function parsePayload(json: string): BackupPayload {
  let raw: Partial<BackupPayload>;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('The backup contents are damaged.');
  }
  if (raw.magic !== MAGIC || !Array.isArray(raw.passwords) || !Array.isArray(raw.cards)) {
    throw new Error('This is not a Passcard Store backup.');
  }
  return {
    magic: MAGIC,
    version: typeof raw.version === 'number' ? raw.version : 1,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : '',
    passwords: raw.passwords.map(normalizePassword).filter((p): p is PasswordEntry => p !== null),
    cards: raw.cards.map(normalizeCard).filter((c): c is CardEntry => c !== null),
    settings: raw.settings && typeof raw.settings === 'object' ? raw.settings : undefined,
  };
}

/**
 * Decrypt a backup's text with its backup password (current files) or the
 * PIN it was made with (v1.0–v1.1 files). Throws a user-facing message.
 */
export async function decryptBackup(content: string, secret: string): Promise<BackupPayload> {
  const kind = detectBackupKind(content);
  if (kind === 'legacy') return parsePayload(legacyDecryptBackup(content, secret));
  if (kind !== 'current') throw new Error('This is not a Passcard Store backup.');

  const file = JSON.parse(content.trim()) as BackupFile;
  if (file.v > FORMAT_VERSION) throw new Error('This backup is from a newer version. Update the app first.');
  if (!isKdfParams(file.kdf) || typeof file.data !== 'string') throw new Error('The backup file is damaged.');
  const keyBytes = await deriveKey(secret, file.kdf);
  let plain: Uint8Array;
  try {
    plain = await open(await importAeadKey(keyBytes), file.data, PAYLOAD_AAD);
  } catch {
    throw new Error('Wrong backup password, or the file is damaged.');
  } finally {
    wipeBytes(keyBytes);
  }
  return parsePayload(utf8Decode(plain));
}

export async function readBackupFile(uri: string): Promise<string> {
  return new File(uri).text();
}

export interface RestoreResult {
  passwords: number;
  cards: number;
  /** Merge only: items kept because this vault's copy was newer. */
  keptNewer: number;
}

/**
 * Apply a decrypted backup.
 * - replace: everything currently in the vault is removed first.
 * - merge: items missing here are added; for items in both, the most
 *   recently edited copy wins.
 * Records are sealed before the transaction starts, and both tables change in
 * one transaction, so a failure leaves the vault as it was.
 */
export async function applyBackup(payload: BackupPayload, mode: 'replace' | 'merge'): Promise<RestoreResult> {
  let passwords = payload.passwords;
  let cards = payload.cards;
  let keptNewer = 0;

  if (mode === 'merge') {
    const [localPasswords, localCards] = await Promise.all([passwordRepository.findAll(), cardRepository.findAll()]);
    const newer = <T extends { id: string; updatedAt: string }>(incoming: T[], local: T[]) => {
      const byId = new Map(local.map((x) => [x.id, x]));
      return incoming.filter((item) => {
        const mine = byId.get(item.id);
        if (mine && mine.updatedAt >= item.updatedAt) {
          keptNewer++;
          return false;
        }
        return true;
      });
    };
    passwords = newer(passwords, localPasswords);
    cards = newer(cards, localCards);
  }

  const [sealedPasswords, sealedCards] = await Promise.all([
    passwordRepository.sealMany(passwords),
    cardRepository.sealMany(cards),
  ]);
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    if (mode === 'replace') {
      await passwordRepository.deleteAllTx(db);
      await cardRepository.deleteAllTx(db);
    }
    await passwordRepository.writeSealedTx(db, sealedPasswords);
    await cardRepository.writeSealedTx(db, sealedCards);
  });

  return { passwords: passwords.length, cards: cards.length, keptNewer };
}

/** Settings carried in a backup that are safe to apply on another device. */
export function backupCategories(payload: BackupPayload): string[] | null {
  return sanitizeCategories(payload.settings?.categories);
}

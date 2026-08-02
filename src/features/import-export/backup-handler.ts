import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ExpoCrypto from 'expo-crypto';
import CryptoJS from 'crypto-js';
import { passwordRepository } from '@/storage/password-repository';
import { cardRepository } from '@/storage/card-repository';
import { getDatabase } from '@/storage/database';
import { loadSettings, saveSetting } from '@/storage/settings-storage';
import type { PasswordEntry } from '@/types/password';
import type { CardEntry } from '@/types/card';
import type { AppSettings } from '@/types/settings';

const BACKUP_VERSION = 1;
const BACKUP_MAGIC = 'PASSCARD_VAULT';
// A high iteration count is affordable here because backups are infrequent.
const BACKUP_ITERATIONS = 210_000;
// Old builds used a single hard-coded salt and 5k iterations. Kept only so
// existing backups can still be restored.
const LEGACY_ITERATIONS = 5_000;
const LEGACY_SALT = 'passcard-backup-salt-v1';

interface BackupPayload {
  magic: string;
  version: number;
  timestamp: string;
  passwords: PasswordEntry[];
  cards: CardEntry[];
  settings: AppSettings;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive a backup encryption key from the PIN using a per-backup random salt.
 * A random salt makes each backup's key unique, defeating precomputation and
 * cross-file/cross-user attacks that a shared static salt would allow.
 */
function deriveBackupKey(pin: string, saltHex: string): string {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  return CryptoJS.PBKDF2(pin, salt, {
    keySize: 256 / 32,
    iterations: BACKUP_ITERATIONS,
  }).toString(CryptoJS.enc.Hex);
}

function deriveLegacyBackupKey(pin: string): string {
  const salt = CryptoJS.enc.Utf8.parse(LEGACY_SALT);
  return CryptoJS.PBKDF2(pin, salt, {
    keySize: 256 / 32,
    iterations: LEGACY_ITERATIONS,
  }).toString(CryptoJS.enc.Hex);
}

/**
 * Create an encrypted .vaultx backup file.
 * File format: `<saltHex>:<ivHex>:<ciphertext>`
 */
export async function createBackup(pin: string): Promise<string> {
  const passwords = await passwordRepository.findAll();
  const cards = await cardRepository.findAll();
  const settings = await loadSettings();

  const payload: BackupPayload = {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    timestamp: new Date().toISOString(),
    passwords,
    cards,
    settings,
  };

  const jsonString = JSON.stringify(payload);
  const saltHex = bytesToHex(ExpoCrypto.getRandomBytes(16));
  const backupKey = deriveBackupKey(pin, saltHex);
  const keyWordArray = CryptoJS.enc.Hex.parse(backupKey);
  const ivHex = bytesToHex(ExpoCrypto.getRandomBytes(16));
  const iv = CryptoJS.enc.Hex.parse(ivHex);

  const encrypted = CryptoJS.AES.encrypt(jsonString, keyWordArray, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const backupContent = `${saltHex}:${ivHex}:${encrypted.toString()}`;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `passcard-backup-${timestamp}.vaultx`;
  const file = new File(Paths.cache, filename);
  file.write(backupContent);

  return file.uri;
}

/**
 * Share the backup file via native share sheet
 */
export async function shareBackup(fileUri: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Save Passcard Backup',
  });
}

/**
 * Decrypt a .vaultx file's contents into a validated payload.
 * Supports both the new salted format and the legacy static-salt format.
 */
function decryptBackup(content: string, pin: string): BackupPayload {
  const parts = content.split(':');

  let saltDerivedKey: string;
  let ivHex: string;
  let ciphertext: string;

  if (parts.length === 3) {
    // New format: salt:iv:ciphertext
    saltDerivedKey = deriveBackupKey(pin, parts[0]);
    ivHex = parts[1];
    ciphertext = parts[2];
  } else if (parts.length === 2) {
    // Legacy format: iv:ciphertext (static salt)
    saltDerivedKey = deriveLegacyBackupKey(pin);
    ivHex = parts[0];
    ciphertext = parts[1];
  } else {
    throw new Error('Invalid backup file format');
  }

  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const keyWordArray = CryptoJS.enc.Hex.parse(saltDerivedKey);

  let decryptedString: string;
  try {
    const decrypted = CryptoJS.AES.decrypt(ciphertext, keyWordArray, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new Error('Decryption failed. Wrong PIN or corrupted backup.');
  }

  if (!decryptedString) {
    throw new Error('Decryption failed. Wrong PIN or corrupted backup.');
  }

  let payload: BackupPayload;
  try {
    payload = JSON.parse(decryptedString);
  } catch {
    throw new Error('Invalid backup data format');
  }

  if (payload.magic !== BACKUP_MAGIC) {
    throw new Error('Not a valid Passcard Store backup file');
  }
  if (!Array.isArray(payload.passwords) || !Array.isArray(payload.cards)) {
    throw new Error('Backup is missing expected data');
  }

  return payload;
}

/**
 * Restore from an encrypted .vaultx backup file.
 * The whole operation is validated up front and applied inside a single
 * transaction spanning both tables, so a failure can never leave the vault
 * half-wiped.
 */
export async function restoreBackup(
  fileUri: string,
  pin: string,
): Promise<{ passwords: number; cards: number }> {
  const file = new File(fileUri);
  const content = await file.text();

  // Validate + decrypt BEFORE touching existing data.
  const payload = decryptBackup(content, pin);

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await passwordRepository.deleteAllTx(db);
    await cardRepository.deleteAllTx(db);
    await passwordRepository.insertAllTx(db, payload.passwords);
    await cardRepository.insertAllTx(db, payload.cards);
  });

  // Restore device-agnostic preferences (not biometrics/PIN, which are
  // specific to this device and secret).
  if (payload.settings) {
    if (payload.settings.autoLockDuration !== undefined) {
      await saveSetting('autoLockDuration', payload.settings.autoLockDuration).catch(() => {});
    }
    if (payload.settings.clipboardClearDuration !== undefined) {
      await saveSetting('clipboardClearDuration', payload.settings.clipboardClearDuration).catch(() => {});
    }
  }

  return {
    passwords: payload.passwords.length,
    cards: payload.cards.length,
  };
}

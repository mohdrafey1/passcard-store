import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ExpoCrypto from 'expo-crypto';
import CryptoJS from 'crypto-js';
import { passwordRepository } from '@/storage/password-repository';
import { cardRepository } from '@/storage/card-repository';
import { loadSettings } from '@/storage/settings-storage';
import type { PasswordEntry } from '@/types/password';
import type { CardEntry } from '@/types/card';
import type { AppSettings } from '@/types/settings';

const BACKUP_VERSION = 1;
const BACKUP_MAGIC = 'PASSCARD_VAULT';

interface BackupPayload {
  magic: string;
  version: number;
  timestamp: string;
  passwords: PasswordEntry[];
  cards: CardEntry[];
  settings: AppSettings;
}

/**
 * Derive an encryption key from PIN for backup encryption
 * (separate from the vault encryption key)
 */
function deriveBackupKey(pin: string): string {
  const salt = CryptoJS.enc.Utf8.parse('passcard-backup-salt-v1');
  return CryptoJS.PBKDF2(pin, salt, {
    keySize: 256 / 32,
    iterations: 5000,
  }).toString(CryptoJS.enc.Hex);
}

/**
 * Create an encrypted .vaultx backup file
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
  const backupKey = deriveBackupKey(pin);
  const keyWordArray = CryptoJS.enc.Hex.parse(backupKey);
  // Use expo-crypto's native secure RNG for the IV (see security/encryption.ts).
  const ivHex = Array.from(ExpoCrypto.getRandomBytes(16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const iv = CryptoJS.enc.Hex.parse(ivHex);

  const encrypted = CryptoJS.AES.encrypt(jsonString, keyWordArray, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const backupContent = iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();

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
 * Restore from an encrypted .vaultx backup file
 */
export async function restoreBackup(
  fileUri: string,
  pin: string,
): Promise<{ passwords: number; cards: number }> {
  const file = new File(fileUri);
  const content = await file.text();

  const parts = content.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid backup file format');
  }

  const backupKey = deriveBackupKey(pin);
  const iv = CryptoJS.enc.Hex.parse(parts[0]);
  const keyWordArray = CryptoJS.enc.Hex.parse(backupKey);

  let decryptedString: string;
  try {
    const decrypted = CryptoJS.AES.decrypt(parts[1], keyWordArray, {
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

  // Clear existing data and import
  await passwordRepository.deleteAll();
  await cardRepository.deleteAll();

  if (payload.passwords.length > 0) {
    await passwordRepository.bulkCreate(payload.passwords);
  }

  if (payload.cards.length > 0) {
    await cardRepository.bulkCreate(payload.cards);
  }

  return {
    passwords: payload.passwords.length,
    cards: payload.cards.length,
  };
}

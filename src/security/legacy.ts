import CryptoJS from 'crypto-js';

/**
 * Read-only support for the formats written by v1.0–v1.1 (crypto-js, AES-CBC
 * without authentication, PBKDF2 at 5k–210k iterations). Nothing new is ever
 * written in these formats; they exist so existing vaults and backups can be
 * opened once and upgraded.
 */

/** Records and wrapped keys: `<ivHex>:<base64 ciphertext>`. */
export function isLegacyCiphertext(value: string): boolean {
  return /^[0-9a-f]{32}:/i.test(value);
}

export function legacyDecrypt(cipherText: string, keyHex: string): string {
  const parts = cipherText.split(':');
  if (parts.length !== 2) throw new Error('Invalid ciphertext format');
  const decrypted = CryptoJS.AES.decrypt(parts[1], CryptoJS.enc.Hex.parse(keyHex), {
    iv: CryptoJS.enc.Hex.parse(parts[0]),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

export function legacyPbkdf2Hex(secret: string, saltHex: string, iterations: number): string {
  return CryptoJS.PBKDF2(secret, CryptoJS.enc.Hex.parse(saltHex), {
    keySize: 256 / 32,
    iterations,
  }).toString(CryptoJS.enc.Hex);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** v1.0 stored PBKDF2(PIN, salt, 10k) as a separate PIN hash. */
export function legacyVerifyPinHash(pin: string, hashHex: string, saltHex: string): boolean {
  return timingSafeEqual(legacyPbkdf2Hex(pin, saltHex, 10_000), hashHex);
}

// ---- Backups written before v1.3 (encrypted with the vault PIN) ----

const LEGACY_BACKUP_SALT = 'passcard-backup-salt-v1';

/**
 * Decrypt a pre-v1.3 backup file's text. Three layouts existed:
 * `salt:iterations:iv:ct`, `salt:iv:ct` (210k) and `iv:ct` (static salt, 5k).
 * Returns the JSON string, or throws when the PIN is wrong.
 */
export function legacyDecryptBackup(content: string, pin: string): string {
  const parts = content.trim().split(':');
  let keyHex: string;
  let ivHex: string;
  let ciphertext: string;

  if (parts.length === 4) {
    keyHex = legacyPbkdf2Hex(pin, parts[0], parseInt(parts[1], 10) || 30_000);
    [, , ivHex, ciphertext] = parts;
  } else if (parts.length === 3) {
    keyHex = legacyPbkdf2Hex(pin, parts[0], 210_000);
    [, ivHex, ciphertext] = parts;
  } else if (parts.length === 2) {
    keyHex = CryptoJS.PBKDF2(pin, CryptoJS.enc.Utf8.parse(LEGACY_BACKUP_SALT), {
      keySize: 256 / 32,
      iterations: 5_000,
    }).toString(CryptoJS.enc.Hex);
    [ivHex, ciphertext] = parts;
  } else {
    throw new Error('Not a Passcard Store backup file.');
  }

  let text = '';
  try {
    text = legacyDecrypt(`${ivHex}:${ciphertext}`, keyHex);
  } catch {
    text = '';
  }
  if (!text) throw new Error('Wrong PIN, or the file is damaged.');
  return text;
}

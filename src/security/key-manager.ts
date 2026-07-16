import * as ExpoCrypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';
import { encrypt, decrypt, generateEncryptionKey } from './encryption';
import { verifyStoredPin } from './pin';

/**
 * Key manager
 * -----------
 * The vault data key is never stored in plaintext. Instead it is wrapped with a
 * key-encryption-key (KEK) derived from the user's PIN (PBKDF2). The unwrapped
 * data key lives only in memory for the duration of a session, so the encrypted
 * SQLite database cannot be decrypted without the PIN — even on a device where
 * SecureStore contents are extractable.
 *
 * Biometric unlock is a deliberate convenience trade-off: when the user opts in,
 * a copy of the data key is placed in a separate SecureStore slot so the key can
 * be recovered after an OS biometric prompt without re-deriving from the PIN.
 * Disabling biometrics removes that slot.
 */

const WRAPPED_KEY = 'VAULT_KEY_WRAPPED';
const WRAP_SALT = 'VAULT_KEY_SALT';
const BIOMETRIC_KEY = 'VAULT_KEY_BIOMETRIC';
const LEGACY_KEY = 'VAULT_ENCRYPTION_KEY'; // plaintext key from pre-KEK builds

// Prefix stored inside the wrapped blob so a wrong PIN is detected reliably
// (AES-CBC/PKCS7 does not always throw on a wrong key).
const KEY_MARKER = 'PCSKv1:';
const KEK_ITERATIONS = 100_000;

// In-memory session data key. Set on unlock, cleared on lock/wipe.
let sessionKey: string | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function deriveKek(pin: string, saltHex: string): string {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  return CryptoJS.PBKDF2(pin, salt, {
    keySize: 256 / 32,
    iterations: KEK_ITERATIONS,
  }).toString(CryptoJS.enc.Hex);
}

/** Wrap `dataKey` under a fresh PIN-derived KEK and persist it. */
async function wrapAndStore(dataKey: string, pin: string): Promise<void> {
  const saltHex = bytesToHex(ExpoCrypto.getRandomBytes(16));
  const kek = deriveKek(pin, saltHex);
  const wrapped = encrypt(KEY_MARKER + dataKey, kek);
  // Verify the round-trip before persisting so we can never lock the user out.
  const check = decrypt(wrapped, kek);
  if (check !== KEY_MARKER + dataKey) {
    throw new Error('Key wrap verification failed');
  }
  await SecureStore.setItemAsync(WRAP_SALT, saltHex);
  await SecureStore.setItemAsync(WRAPPED_KEY, wrapped);
}

/** Attempt to unwrap the stored key with `pin`. Returns null on wrong PIN. */
function tryUnwrap(pin: string, wrapped: string, saltHex: string): string | null {
  try {
    const kek = deriveKek(pin, saltHex);
    const plain = decrypt(wrapped, kek);
    if (!plain.startsWith(KEY_MARKER)) return null;
    return plain.slice(KEY_MARKER.length);
  } catch {
    return null;
  }
}

// ---- Session ----

export function getSessionKey(): string {
  if (!sessionKey) {
    throw new Error('Vault is locked. Unlock before accessing data.');
  }
  return sessionKey;
}

export function hasSessionKey(): boolean {
  return sessionKey !== null;
}

export function clearSessionKey(): void {
  sessionKey = null;
}

// ---- Provisioning / unlock ----

/**
 * Create a brand-new data key for a first-time PIN and open the session.
 */
export async function provisionKeyForNewPin(pin: string): Promise<void> {
  const dataKey = generateEncryptionKey();
  await wrapAndStore(dataKey, pin);
  await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {});
  sessionKey = dataKey;
}

/**
 * Unlock with a PIN. Verifies the PIN by unwrapping the data key (or, for
 * pre-KEK installs, migrates the legacy plaintext key into a wrapped key).
 * Returns true on success and opens the session.
 */
export async function unlockWithPin(pin: string): Promise<boolean> {
  const wrapped = await SecureStore.getItemAsync(WRAPPED_KEY);
  const saltHex = await SecureStore.getItemAsync(WRAP_SALT);

  if (wrapped && saltHex) {
    const key = tryUnwrap(pin, wrapped, saltHex);
    if (!key) return false;
    sessionKey = key;
    return true;
  }

  // Legacy migration path: a plaintext key exists from an older build. Here the
  // wrapped key isn't available to validate the PIN, so verify against the
  // stored PIN hash BEFORE migrating — otherwise a wrong PIN would re-wrap the
  // key under the wrong secret and lock the user out of their own data.
  const legacy = await SecureStore.getItemAsync(LEGACY_KEY);
  if (!legacy) return false;
  const pinOk = await verifyStoredPin(pin);
  if (!pinOk) return false;
  // Wrap the legacy key under the supplied PIN (verified internally), then drop
  // the plaintext copy.
  await wrapAndStore(legacy, pin);
  await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {});
  sessionKey = legacy;
  return true;
}

/**
 * Re-wrap the current session key under a new PIN (used by Change PIN).
 * Requires an open session.
 */
export async function rewrapForNewPin(newPin: string): Promise<void> {
  const key = getSessionKey();
  await wrapAndStore(key, newPin);
}

// ---- Biometric convenience slot ----

export async function enableBiometricKey(): Promise<void> {
  const key = getSessionKey();
  await SecureStore.setItemAsync(BIOMETRIC_KEY, key);
}

export async function disableBiometricKey(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY).catch(() => {});
}

/**
 * Open the session from the biometric slot. The caller must have already passed
 * the OS biometric prompt. Returns false if no biometric key is provisioned.
 */
export async function unlockWithBiometricKey(): Promise<boolean> {
  const key = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  if (!key) return false;
  sessionKey = key;
  return true;
}

// ---- Wipe ----

export async function wipeKeys(): Promise<void> {
  sessionKey = null;
  await Promise.all([
    SecureStore.deleteItemAsync(WRAPPED_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(WRAP_SALT).catch(() => {}),
    SecureStore.deleteItemAsync(BIOMETRIC_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {}),
  ]);
}

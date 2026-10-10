import * as ExpoCrypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { importAeadKey, open, seal, type AeadKey } from './aead';
import { bytesToHex, hexToBytes, utf8Encode, wipeBytes } from './bytes';
import { createKdfParams, deriveKey, isKdfParams, type KdfParams } from './kdf';
import { legacyDecrypt, legacyPbkdf2Hex, legacyVerifyPinHash } from './legacy';

/**
 * Key manager
 * -----------
 * A random 256-bit data key encrypts every vault record. That key is never
 * stored in the clear: it lives in a single "key slot", wrapped (AES-256-GCM)
 * under a key derived from the user's PIN or passphrase with Argon2id. The slot
 * is one SecureStore value, so changing the PIN is a single atomic write and a
 * wrong PIN is detected by the GCM tag, with no separate PIN hash to keep in
 * sync.
 *
 * Fingerprint unlock keeps a second copy of the data key in SecureStore with
 * `requireAuthentication`, so Android's hardware keystore only releases it
 * after a successful biometric match.
 *
 * The unwrapped key exists only in memory while the vault is unlocked;
 * `lockSession()` drops it.
 */

export type UnlockMethod = 'pin' | 'passphrase';

export interface UnlockInfo {
  method: UnlockMethod;
  /** Digits for a PIN; null for a passphrase. */
  pinLength: 4 | 6 | null;
}

interface KeySlot {
  v: 2;
  method: UnlockMethod;
  pinLength?: 4 | 6;
  kdf: KdfParams;
  /** Data key sealed under the PIN-derived key. */
  wrapped: string;
  /** A constant sealed under the data key, to verify a key released by biometrics. */
  check: string;
}

interface Session {
  keyHex: string;
  aead: AeadKey;
}

const SLOT_KEY = 'VAULT_KEYSLOT_V2';
const BIO_KEY = 'VAULT_KEY_BIO_V2';
const BIO_FLAG = 'VAULT_BIO_ENABLED';
const BIO_REOFFER = 'VAULT_BIO_REOFFER';

const SLOT_AAD = 'passcard:keyslot:v2';
const CHECK_AAD = 'passcard:keycheck:v2';
const CHECK_TEXT = 'passcard-key-check';

// Written by v1.0–v1.1. Read once to migrate, then deleted.
const LEGACY = {
  wrapped: 'VAULT_KEY_WRAPPED',
  salt: 'VAULT_KEY_SALT',
  iters: 'VAULT_KEY_ITERS',
  plainKey: 'VAULT_ENCRYPTION_KEY',
  biometric: 'VAULT_KEY_BIOMETRIC',
  pinHash: 'PIN_HASH',
  pinSalt: 'PIN_SALT',
  pinLength: 'PIN_LENGTH',
} as const;
const LEGACY_MARKER = 'PCSKv1:';
const LEGACY_DEFAULT_ITERS = 100_000;

let session: Session | null = null;

// ---- Session ----

async function openSession(keyBytes: Uint8Array): Promise<void> {
  session = { keyHex: bytesToHex(keyBytes), aead: await importAeadKey(keyBytes) };
}

export function getSession(): Session {
  if (!session) throw new Error('Vault is locked. Unlock before accessing data.');
  return session;
}

export function isUnlocked(): boolean {
  return session !== null;
}

export function lockSession(): void {
  session = null;
}

// ---- Key slot ----

async function buildSlot(
  dataKey: Uint8Array,
  secret: string,
  method: UnlockMethod,
  pinLength: 4 | 6 | null,
): Promise<KeySlot> {
  const kdf = await createKdfParams();
  const kekBytes = await deriveKey(secret, kdf);
  try {
    const kek = await importAeadKey(kekBytes);
    const wrapped = await seal(kek, dataKey, SLOT_AAD);
    // Round-trip before anything is persisted so a slot can never lock the
    // user out of their own data.
    const back = await open(kek, wrapped, SLOT_AAD);
    if (bytesToHex(back) !== bytesToHex(dataKey)) throw new Error('Key wrap verification failed');
    const check = await seal(await importAeadKey(dataKey), utf8Encode(CHECK_TEXT), CHECK_AAD);
    return {
      v: 2,
      method,
      ...(method === 'pin' && pinLength ? { pinLength } : {}),
      kdf,
      wrapped,
      check,
    };
  } finally {
    wipeBytes(kekBytes);
  }
}

async function readSlot(): Promise<KeySlot | null> {
  const raw = await SecureStore.getItemAsync(SLOT_KEY);
  if (!raw) return null;
  try {
    const slot = JSON.parse(raw) as KeySlot;
    if (slot.v === 2 && isKdfParams(slot.kdf) && typeof slot.wrapped === 'string') return slot;
  } catch {
    // fall through
  }
  throw new Error('The vault key is damaged.');
}

async function writeSlot(slot: KeySlot): Promise<void> {
  await SecureStore.setItemAsync(SLOT_KEY, JSON.stringify(slot));
}

/** Returns the data key, or null when `secret` is wrong. */
async function unwrapSlot(slot: KeySlot, secret: string): Promise<Uint8Array | null> {
  const kekBytes = await deriveKey(secret, slot.kdf);
  try {
    const kek = await importAeadKey(kekBytes);
    const key = await open(kek, slot.wrapped, SLOT_AAD);
    return key.length === 32 ? key : null;
  } catch {
    return null;
  } finally {
    wipeBytes(kekBytes);
  }
}

// ---- Legacy (v1.0–v1.1) ----

async function legacyUnwrap(pin: string): Promise<string | null> {
  const [wrapped, salt, iters] = await Promise.all([
    SecureStore.getItemAsync(LEGACY.wrapped),
    SecureStore.getItemAsync(LEGACY.salt),
    SecureStore.getItemAsync(LEGACY.iters),
  ]);
  if (wrapped && salt) {
    try {
      const kekHex = legacyPbkdf2Hex(pin, salt, iters ? parseInt(iters, 10) : LEGACY_DEFAULT_ITERS);
      const plain = legacyDecrypt(wrapped, kekHex);
      return plain.startsWith(LEGACY_MARKER) ? plain.slice(LEGACY_MARKER.length) : null;
    } catch {
      return null;
    }
  }
  // Oldest builds kept the data key in plaintext next to a PIN hash.
  const [plainKey, pinHash, pinSalt] = await Promise.all([
    SecureStore.getItemAsync(LEGACY.plainKey),
    SecureStore.getItemAsync(LEGACY.pinHash),
    SecureStore.getItemAsync(LEGACY.pinSalt),
  ]);
  if (plainKey && pinHash && pinSalt && legacyVerifyPinHash(pin, pinHash, pinSalt)) return plainKey;
  return null;
}

async function deleteLegacyKeys(): Promise<void> {
  await Promise.all(
    Object.values(LEGACY).map((k) => SecureStore.deleteItemAsync(k).catch(() => {})),
  );
}

// ---- Public API ----

/** True when a vault exists on this device (current or legacy format). */
export async function hasVault(): Promise<boolean> {
  const [slot, wrapped, pinHash] = await Promise.all([
    SecureStore.getItemAsync(SLOT_KEY),
    SecureStore.getItemAsync(LEGACY.wrapped),
    SecureStore.getItemAsync(LEGACY.pinHash),
  ]);
  return slot !== null || wrapped !== null || pinHash !== null;
}

export async function getUnlockInfo(): Promise<UnlockInfo> {
  const slot = await readSlot();
  if (slot) {
    return slot.method === 'pin'
      ? { method: 'pin', pinLength: slot.pinLength ?? 6 }
      : { method: 'passphrase', pinLength: null };
  }
  const legacyLength = await SecureStore.getItemAsync(LEGACY.pinLength);
  return { method: 'pin', pinLength: legacyLength === '6' ? 6 : 4 };
}

/** Create a brand-new vault key protected by `secret`, and open the session. */
export async function createVault(secret: string, method: UnlockMethod, pinLength: 4 | 6 | null): Promise<void> {
  const dataKey = ExpoCrypto.getRandomBytes(32);
  try {
    await writeSlot(await buildSlot(dataKey, secret, method, pinLength));
    await deleteLegacyKeys();
    await openSession(dataKey);
  } finally {
    wipeBytes(dataKey);
  }
}

/**
 * Unlock with a PIN or passphrase. A vault from v1.0–v1.1 is upgraded to the
 * current key slot on its first successful unlock. Returns false on a wrong
 * secret.
 */
export async function unlockWithSecret(secret: string): Promise<boolean> {
  const slot = await readSlot();
  if (slot) {
    const key = await unwrapSlot(slot, secret);
    if (!key) return false;
    await openSession(key);
    wipeBytes(key);
    return true;
  }

  const legacyKeyHex = await legacyUnwrap(secret);
  if (!legacyKeyHex) return false;
  const keyBytes = hexToBytes(legacyKeyHex);
  const info = await getUnlockInfo();
  // Write the new slot before removing anything old: if the app dies in
  // between, the new slot simply wins next time.
  await writeSlot(await buildSlot(keyBytes, secret, 'pin', info.pinLength ?? 4));
  await deleteLegacyKeys();
  await openSession(keyBytes);
  wipeBytes(keyBytes);
  return true;
}

/** Check a PIN/passphrase without changing the session (re-auth prompts). */
export async function verifySecret(secret: string): Promise<boolean> {
  const slot = await readSlot();
  if (slot) {
    const key = await unwrapSlot(slot, secret);
    wipeBytes(key);
    return key !== null;
  }
  return (await legacyUnwrap(secret)) !== null;
}

/**
 * Re-protect the open vault with a new PIN or passphrase. One SecureStore
 * write replaces the old slot, so there is no half-changed state.
 */
export async function changeSecret(newSecret: string, method: UnlockMethod, pinLength: 4 | 6 | null): Promise<void> {
  const keyBytes = hexToBytes(getSession().keyHex);
  try {
    await writeSlot(await buildSlot(keyBytes, newSecret, method, pinLength));
  } finally {
    wipeBytes(keyBytes);
  }
}

// ---- Fingerprint unlock ----

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIO_FLAG)) === '1';
}

/** Store the key behind a biometric check. Shows the system fingerprint prompt. */
export async function enableBiometricUnlock(): Promise<void> {
  const { keyHex } = getSession();
  await SecureStore.setItemAsync(BIO_KEY, keyHex, {
    requireAuthentication: true,
    authenticationPrompt: 'Confirm your fingerprint to turn on fingerprint unlock',
  });
  await SecureStore.setItemAsync(BIO_FLAG, '1');
  await SecureStore.deleteItemAsync(BIO_REOFFER).catch(() => {});
}

export async function disableBiometricUnlock(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(BIO_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(BIO_FLAG).catch(() => {}),
  ]);
}

export type BiometricUnlockResult = 'ok' | 'cancelled' | 'invalidated';

/**
 * Ask Android to release the key with a fingerprint. 'invalidated' means the
 * keystore dropped the key (for example after a new fingerprint was enrolled),
 * so fingerprint unlock is switched off and the PIN is needed.
 */
export async function unlockWithBiometrics(): Promise<BiometricUnlockResult> {
  const slot = await readSlot();
  let keyHex: string | null;
  try {
    keyHex = await SecureStore.getItemAsync(BIO_KEY, {
      requireAuthentication: true,
      authenticationPrompt: 'Unlock Passcard Store',
    });
  } catch {
    return 'cancelled';
  }
  if (!keyHex || !/^[0-9a-f]{64}$/i.test(keyHex) || !slot) {
    await disableBiometricUnlock();
    return 'invalidated';
  }
  const keyBytes = hexToBytes(keyHex);
  try {
    await open(await importAeadKey(keyBytes), slot.check, CHECK_AAD);
  } catch {
    await disableBiometricUnlock();
    return 'invalidated';
  }
  await openSession(keyBytes);
  wipeBytes(keyBytes);
  return 'ok';
}

/**
 * v1.0–v1.1 kept a plain copy of the key for fingerprint unlock and enabled it
 * by default. Remove that copy at boot; if the user had fingerprint unlock on,
 * remember to offer re-enrolling it (behind the keystore) after their next
 * PIN unlock.
 */
export async function migrateLegacyBiometrics(wasEnabled: boolean): Promise<void> {
  const legacyCopy = await SecureStore.getItemAsync(LEGACY.biometric).catch(() => null);
  if (legacyCopy === null) return;
  await SecureStore.deleteItemAsync(LEGACY.biometric).catch(() => {});
  if (wasEnabled) await SecureStore.setItemAsync(BIO_REOFFER, '1');
}

export async function shouldReofferBiometrics(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIO_REOFFER)) === '1';
}

export async function dismissBiometricReoffer(): Promise<void> {
  await SecureStore.deleteItemAsync(BIO_REOFFER).catch(() => {});
}

// ---- Wipe ----

export async function wipeKeys(): Promise<void> {
  session = null;
  await Promise.all(
    [SLOT_KEY, BIO_KEY, BIO_FLAG, BIO_REOFFER, ...Object.values(LEGACY)].map((k) =>
      SecureStore.deleteItemAsync(k).catch(() => {}),
    ),
  );
}

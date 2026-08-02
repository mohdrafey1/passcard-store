import * as ExpoCrypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

const PIN_HASH_KEY = 'PIN_HASH';
const PIN_SALT_KEY = 'PIN_SALT';
const PIN_LENGTH_KEY = 'PIN_LENGTH';
const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEY_SIZE = 256 / 32; // 256-bit key

/**
 * Generate a random salt for PIN hashing
 */
export function generateSalt(): string {
  const saltBytes = ExpoCrypto.getRandomBytes(16);
  return Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a PIN using PBKDF2 with salt
 */
export function hashPin(pin: string, salt: string): string {
  const saltWordArray = CryptoJS.enc.Hex.parse(salt);
  const key = CryptoJS.PBKDF2(pin, saltWordArray, {
    keySize: PBKDF2_KEY_SIZE,
    iterations: PBKDF2_ITERATIONS,
  });
  return key.toString(CryptoJS.enc.Hex);
}

/**
 * Constant-time string comparison to avoid leaking how many leading
 * characters of a hash matched via timing.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify a PIN against the stored hash
 */
export function verifyPin(pin: string, storedHash: string, salt: string): boolean {
  const computedHash = hashPin(pin, salt);
  return timingSafeEqual(computedHash, storedHash);
}

/**
 * Create and store a new PIN
 */
export async function createPin(pin: string): Promise<void> {
  const salt = generateSalt();
  const hash = hashPin(pin, salt);
  const pinLength = pin.length.toString();

  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(PIN_LENGTH_KEY, pinLength);
}

/**
 * Verify the user's PIN against stored hash
 */
export async function verifyStoredPin(pin: string): Promise<boolean> {
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);

  if (!storedHash || !salt) {
    return false;
  }

  return verifyPin(pin, storedHash, salt);
}

/**
 * Change the user's PIN
 */
export async function changePin(newPin: string): Promise<void> {
  await createPin(newPin);
}

/**
 * Check if a PIN has been set up
 */
export async function isPinSetup(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return hash !== null;
}

/**
 * Get the configured PIN length
 */
export async function getPinLength(): Promise<4 | 6> {
  const length = await SecureStore.getItemAsync(PIN_LENGTH_KEY);
  return length === '6' ? 6 : 4;
}

/**
 * Delete PIN data (used during full data wipe)
 */
export async function deletePin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(PIN_LENGTH_KEY);
}

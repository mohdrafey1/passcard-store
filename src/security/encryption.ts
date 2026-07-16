import * as ExpoCrypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

/**
 * Low-level cryptographic primitives. Key storage and the PIN-wrapped data key
 * live in `key-manager.ts`; this module only knows how to generate a key and
 * encrypt/decrypt with it.
 */

/**
 * Generate a random 256-bit encryption key using expo-crypto
 */
export function generateEncryptionKey(): string {
  const randomBytes = ExpoCrypto.getRandomBytes(32);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a byte array to a lowercase hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encrypt plaintext using AES-256-CBC
 */
export function encrypt(plainText: string, key: string): string {
  const keyWordArray = CryptoJS.enc.Hex.parse(key);
  // Generate the IV with expo-crypto's native secure RNG instead of
  // CryptoJS.lib.WordArray.random, which relies on a JS getRandomValues
  // polyfill that is unreliable under Hermes and throws on some devices.
  const iv = CryptoJS.enc.Hex.parse(bytesToHex(ExpoCrypto.getRandomBytes(16)));
  const encrypted = CryptoJS.AES.encrypt(plainText, keyWordArray, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // Prepend IV to ciphertext for storage
  const combined = iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
  return combined;
}

/**
 * Decrypt ciphertext using AES-256-CBC
 */
export function decrypt(cipherText: string, key: string): string {
  const parts = cipherText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid ciphertext format');
  }
  const iv = CryptoJS.enc.Hex.parse(parts[0]);
  const encrypted = parts[1];
  const keyWordArray = CryptoJS.enc.Hex.parse(key);
  const decrypted = CryptoJS.AES.decrypt(encrypted, keyWordArray, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

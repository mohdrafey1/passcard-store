import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { base64ToBytes, utf8Encode } from './bytes';

/**
 * Authenticated encryption (AES-256-GCM) on top of expo-crypto's native AES.
 * The output is the "combined" form, base64(iv | ciphertext | tag), with a
 * 12-byte random IV and a 16-byte tag. Any change to the ciphertext, the IV or
 * the associated data makes `open` throw, so corruption and tampering are
 * detected instead of decrypting to garbage.
 */

export type AeadKey = AESEncryptionKey;

export function importAeadKey(keyBytes: Uint8Array): Promise<AeadKey> {
  return AESEncryptionKey.import(keyBytes);
}

export async function seal(key: AeadKey, plaintext: Uint8Array, aad: string): Promise<string> {
  const sealed = await aesEncryptAsync(plaintext, key, { additionalData: utf8Encode(aad) });
  return sealed.combined('base64');
}

/** Throws when the key is wrong or the data was modified. */
export async function open(key: AeadKey, combinedBase64: string, aad: string): Promise<Uint8Array> {
  // Pass bytes, not the base64 string: expo-crypto 56's Android
  // `fromCombined` only accepts a byte array, despite the documented string form.
  const sealed = AESSealedData.fromCombined(base64ToBytes(combinedBase64));
  return aesDecryptAsync(sealed, key, { output: 'bytes', additionalData: utf8Encode(aad) });
}

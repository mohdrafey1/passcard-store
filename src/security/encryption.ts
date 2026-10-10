import { open, seal } from './aead';
import { utf8Decode, utf8Encode } from './bytes';
import { getSession } from './key-manager';
import { isLegacyCiphertext, legacyDecrypt } from './legacy';

/**
 * Record-level encryption. Each record is sealed with AES-256-GCM under the
 * session data key, with `aad` (table and row id) bound in, so a ciphertext
 * cannot be swapped onto another row without detection.
 *
 * Stored form: `g1:` + base64(iv | ciphertext | tag). Records written by
 * v1.0–v1.1 (AES-CBC) are still readable and are rewritten in the current
 * format on unlock.
 */

const PREFIX = 'g1:';

export function isCurrentFormat(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export async function encryptRecord(plaintext: string, aad: string): Promise<string> {
  return PREFIX + (await seal(getSession().aead, utf8Encode(plaintext), aad));
}

export async function decryptRecord(stored: string, aad: string): Promise<string> {
  const session = getSession();
  if (stored.startsWith(PREFIX)) {
    return utf8Decode(await open(session.aead, stored.slice(PREFIX.length), aad));
  }
  if (isLegacyCiphertext(stored)) {
    const text = legacyDecrypt(stored, session.keyHex);
    if (!text) throw new Error('Could not decrypt record');
    return text;
  }
  throw new Error('Unknown record format');
}

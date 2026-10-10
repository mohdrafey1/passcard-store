import * as ExpoCrypto from 'expo-crypto';
import { argon2, pbkdf2 } from 'react-native-quick-crypto';
import { base64ToBytes, bytesToBase64, utf8Encode } from './bytes';

/**
 * Password-based key derivation for the vault key slot and for backups.
 *
 * Argon2id (memory-hard) is preferred; PBKDF2-SHA256 at 600k iterations is the
 * fallback for any device where native Argon2 is unavailable. Both run natively
 * on a background thread (react-native-quick-crypto), so unlock never blocks
 * the UI. The chosen parameters are stored next to the wrapped key, so either
 * can always be re-derived later.
 */

export type KdfParams =
  { alg: 'argon2id'; salt: string; m: number; t: number; p: number } | { alg: 'pbkdf2-sha256'; salt: string; iter: number };

/** OWASP Password Storage Cheat Sheet minimums for Argon2id (19 MiB, t=2, p=1). */
export const ARGON2_PARAMS = { m: 19_456, t: 2, p: 1 } as const;
export const PBKDF2_ITERATIONS = 600_000;
const KEY_BYTES = 32;

let argon2Available: boolean | null = null;

function runArgon2(secret: Uint8Array, salt: Uint8Array, m: number, t: number, p: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    argon2('argon2id', { message: secret, nonce: salt, parallelism: p, tagLength: KEY_BYTES, memory: m, passes: t }, (err, result) =>
      err ? reject(err) : resolve(new Uint8Array(result)),
    );
  });
}

function runPbkdf2(secret: Uint8Array, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    pbkdf2(secret, salt, iterations, KEY_BYTES, 'sha256', (err, result) =>
      err || !result ? reject(err ?? new Error('PBKDF2 failed')) : resolve(new Uint8Array(result)),
    );
  });
}

async function isArgon2Available(): Promise<boolean> {
  if (argon2Available !== null) return argon2Available;
  try {
    await runArgon2(utf8Encode('probe'), new Uint8Array(16), 8, 1, 1);
    argon2Available = true;
  } catch {
    argon2Available = false;
  }
  return argon2Available;
}

/** Fresh parameters (and a random salt) for a new key slot or backup. */
export async function createKdfParams(): Promise<KdfParams> {
  const salt = bytesToBase64(ExpoCrypto.getRandomBytes(16));
  if (await isArgon2Available()) {
    return { alg: 'argon2id', salt, ...ARGON2_PARAMS };
  }
  return { alg: 'pbkdf2-sha256', salt, iter: PBKDF2_ITERATIONS };
}

export function isKdfParams(value: unknown): value is KdfParams {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.salt !== 'string') return false;
  if (v.alg === 'argon2id') {
    return [v.m, v.t, v.p].every((n) => typeof n === 'number' && Number.isInteger(n) && n > 0);
  }
  if (v.alg === 'pbkdf2-sha256') {
    return typeof v.iter === 'number' && Number.isInteger(v.iter) && v.iter > 0;
  }
  return false;
}

/** Derive a 256-bit key from a PIN or password. */
export async function deriveKey(secret: string, params: KdfParams): Promise<Uint8Array> {
  const secretBytes = utf8Encode(secret);
  const salt = base64ToBytes(params.salt);
  try {
    if (params.alg === 'argon2id') {
      return await runArgon2(secretBytes, salt, params.m, params.t, params.p);
    }
    return await runPbkdf2(secretBytes, salt, params.iter);
  } finally {
    secretBytes.fill(0);
  }
}

import CryptoJS from 'crypto-js';
import { isLegacyCiphertext, legacyDecrypt, legacyDecryptBackup, legacyVerifyPinHash } from '../legacy';

// Re-create exactly what v1.0–v1.1 wrote, so the read-only paths are checked
// against real legacy output rather than against themselves.

function v1Encrypt(plain: string, keyHex: string, ivHex: string): string {
  const enc = CryptoJS.AES.encrypt(plain, CryptoJS.enc.Hex.parse(keyHex), {
    iv: CryptoJS.enc.Hex.parse(ivHex),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return ivHex + ':' + enc.toString();
}

function pbkdf2Hex(secret: string, saltHex: string, iterations: number): string {
  return CryptoJS.PBKDF2(secret, CryptoJS.enc.Hex.parse(saltHex), { keySize: 8, iterations }).toString(CryptoJS.enc.Hex);
}

const KEY = 'a1'.repeat(32);
const IV = '0f'.repeat(16);
const SALT = '5a'.repeat(16);

describe('legacy records', () => {
  it('reads a v1.1 record', () => {
    const json = JSON.stringify({ id: 'x', title: 'Netflix', password: 'p@ss ✓' });
    const stored = v1Encrypt(json, KEY, IV);
    expect(isLegacyCiphertext(stored)).toBe(true);
    expect(legacyDecrypt(stored, KEY)).toBe(json);
  });

  it('does not mistake the current format for legacy', () => {
    expect(isLegacyCiphertext('g1:AAAA')).toBe(false);
  });
});

describe('legacy PIN hash', () => {
  it('verifies the PIN it was made from', () => {
    const hash = pbkdf2Hex('4831', SALT, 10_000);
    expect(legacyVerifyPinHash('4831', hash, SALT)).toBe(true);
    expect(legacyVerifyPinHash('4832', hash, SALT)).toBe(false);
  });
});

describe('legacy backups', () => {
  const payload = JSON.stringify({ magic: 'PASSCARD_VAULT', version: 1, passwords: [], cards: [] });

  it('opens the salt:iterations:iv:ct layout with the right PIN', () => {
    const iterations = 1_000; // the real files used 30k; the layout is what matters here
    const key = pbkdf2Hex('4831', SALT, iterations);
    const [iv, ct] = v1Encrypt(payload, key, IV).split(':');
    const file = `${SALT}:${iterations}:${iv}:${ct}`;
    expect(legacyDecryptBackup(file, '4831')).toBe(payload);
  });

  it('throws a readable error for a wrong PIN', () => {
    const iterations = 1_000;
    const key = pbkdf2Hex('4831', SALT, iterations);
    const [iv, ct] = v1Encrypt(payload, key, IV).split(':');
    expect(() => legacyDecryptBackup(`${SALT}:${iterations}:${iv}:${ct}`, '0000')).toThrow(/Wrong PIN/);
  });

  it('rejects files that are not backups', () => {
    expect(() => legacyDecryptBackup('hello world', '1234')).toThrow();
  });
});

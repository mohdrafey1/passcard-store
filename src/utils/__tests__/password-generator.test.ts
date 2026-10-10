import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  generatePassphrase,
  generatePassword,
  generatePin,
  passphraseEntropyBits,
  passwordEntropyBits,
  scoreFromEntropy,
  secureRandomInt,
} from '../password-generator';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)),
}));

describe('secureRandomInt', () => {
  it('stays in range and covers it', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = secureRandomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
      seen.add(n);
    }
    expect(seen.size).toBe(7);
  });
});

describe('generatePassword', () => {
  it('honours length and includes every enabled set', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 12 });
      expect(pw).toHaveLength(12);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it('leaves out look-alike characters when asked', () => {
    const pw = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 64, avoidLookAlikes: true });
    expect(pw).not.toMatch(/[Il1O0o]/);
  });

  it('uses only digits when only numbers are on', () => {
    const pw = generatePassword({ length: 16, lowercase: false, uppercase: false, numbers: true, symbols: false, avoidLookAlikes: false });
    expect(pw).toMatch(/^\d{16}$/);
  });

  it('clamps the length to 8–64', () => {
    expect(generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 2 })).toHaveLength(8);
    expect(generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 500 })).toHaveLength(64);
  });

  it('rates the default 20 characters as very strong', () => {
    expect(scoreFromEntropy(passwordEntropyBits(DEFAULT_PASSWORD_OPTIONS))).toBe(4);
  });
});

describe('generatePassphrase', () => {
  it('builds capitalised words with one number', () => {
    const phrase = generatePassphrase(DEFAULT_PASSPHRASE_OPTIONS);
    const words = phrase.split('-');
    expect(words).toHaveLength(5);
    words.forEach((w) => expect(w).toMatch(/^[A-Z][a-z]+\d?$/));
    expect(phrase.match(/\d/g)).toHaveLength(1);
  });

  it('has about 64 bits at five words', () => {
    expect(Math.round(passphraseEntropyBits({ ...DEFAULT_PASSPHRASE_OPTIONS, includeNumber: false }))).toBe(65);
  });
});

describe('generatePin', () => {
  it('returns digits of the requested length', () => {
    expect(generatePin(8)).toMatch(/^\d{8}$/);
    expect(generatePin(1)).toMatch(/^\d{4}$/);
  });
});

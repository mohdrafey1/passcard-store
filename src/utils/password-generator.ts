import * as ExpoCrypto from 'expo-crypto';
import { EFF_WORDS } from '@/constants/eff-wordlist';

/**
 * Generators for random passwords, passphrases and PINs. Every choice comes
 * from expo-crypto's CSPRNG with rejection sampling (no modulo bias); nothing
 * here uses Math.random().
 */

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
/** Characters that are easy to misread in many fonts. */
const LOOK_ALIKES = new Set('Il1O0o'.split(''));

/** Uniform random integer in [0, max). */
export function secureRandomInt(max: number): number {
  if (max <= 0 || !Number.isInteger(max)) throw new Error('max must be a positive integer');
  if (max === 1) return 0;
  const range = 2 ** 32;
  const limit = range - (range % max);
  for (;;) {
    const b = ExpoCrypto.getRandomBytes(4);
    const n = ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
    if (n < limit) return n % max;
  }
}

function pick(chars: string): string {
  return chars[secureRandomInt(chars.length)];
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// ---- Random password ----

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidLookAlikes: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidLookAlikes: true,
};

export const PASSWORD_LENGTH_RANGE = { min: 8, max: 64 } as const;

function passwordSets(options: PasswordOptions): string[] {
  const clean = (s: string) => (options.avoidLookAlikes ? [...s].filter((c) => !LOOK_ALIKES.has(c)).join('') : s);
  const sets: string[] = [];
  if (options.lowercase) sets.push(clean(LOWER));
  if (options.uppercase) sets.push(clean(UPPER));
  if (options.numbers) sets.push(clean(DIGITS));
  if (options.symbols) sets.push(SYMBOLS);
  return sets.length > 0 ? sets : [clean(LOWER)];
}

/** At least one character from every enabled set, the rest from all of them. */
export function generatePassword(options: PasswordOptions = DEFAULT_PASSWORD_OPTIONS): string {
  const sets = passwordSets(options);
  const length = Math.min(PASSWORD_LENGTH_RANGE.max, Math.max(options.length, sets.length, PASSWORD_LENGTH_RANGE.min));
  const all = sets.join('');
  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  return shuffle(chars).join('');
}

export function passwordEntropyBits(options: PasswordOptions): number {
  const pool = passwordSets(options).join('').length;
  return options.length * Math.log2(pool);
}

// ---- Passphrase ----

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
}

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  words: 5,
  separator: '-',
  capitalize: true,
  includeNumber: true,
};

export const PASSPHRASE_WORDS_RANGE = { min: 3, max: 10 } as const;

export function generatePassphrase(options: PassphraseOptions = DEFAULT_PASSPHRASE_OPTIONS): string {
  const count = Math.min(PASSPHRASE_WORDS_RANGE.max, Math.max(PASSPHRASE_WORDS_RANGE.min, options.words));
  const words = Array.from({ length: count }, () => {
    const w = EFF_WORDS[secureRandomInt(EFF_WORDS.length)];
    return options.capitalize ? w[0].toUpperCase() + w.slice(1) : w;
  });
  if (options.includeNumber) {
    const i = secureRandomInt(words.length);
    words[i] = `${words[i]}${secureRandomInt(10)}`;
  }
  return words.join(options.separator);
}

export function passphraseEntropyBits(options: PassphraseOptions): number {
  const perWord = Math.log2(EFF_WORDS.length);
  const number = options.includeNumber ? Math.log2(10 * options.words) : 0;
  return options.words * perWord + number;
}

// ---- PIN ----

export const PIN_LENGTH_RANGE = { min: 4, max: 12 } as const;

export function generatePin(length = 6): string {
  const n = Math.min(PIN_LENGTH_RANGE.max, Math.max(PIN_LENGTH_RANGE.min, length));
  return Array.from({ length: n }, () => pick(DIGITS)).join('');
}

// ---- Strength from entropy (for generated secrets) ----

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

/** Generated secrets are uniformly random, so entropy is an honest measure. */
export function scoreFromEntropy(bits: number): StrengthScore {
  if (bits >= 100) return 4;
  if (bits >= 70) return 3;
  if (bits >= 50) return 2;
  if (bits >= 30) return 1;
  return 0;
}

export const STRENGTH_LABELS: Record<StrengthScore, string> = {
  0: 'Very weak',
  1: 'Weak',
  2: 'Fair',
  3: 'Strong',
  4: 'Very strong',
};

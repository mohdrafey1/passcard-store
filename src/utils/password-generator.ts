import * as ExpoCrypto from 'expo-crypto';

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/**
 * Return a cryptographically secure random integer in [0, max).
 * Uses expo-crypto's native CSPRNG with rejection sampling to avoid modulo bias.
 * A password manager must never seed generated secrets from Math.random().
 */
function secureRandomInt(max: number): number {
  if (max <= 0) return 0;
  // Largest multiple of `max` that fits in a byte; values at or above this
  // are rejected so every residue class is equally likely.
  const limit = 256 - (256 % max);
  // Draw bytes until we get one below the limit (expected < 2 iterations).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const byte = ExpoCrypto.getRandomBytes(1)[0];
    if (byte < limit) return byte % max;
  }
}

/**
 * Cryptographically secure pick of a random character from a string.
 */
function secureRandomChar(charset: string): string {
  return charset[secureRandomInt(charset.length)];
}

export interface PasswordGeneratorOptions {
  length: number;
  includeLowercase: boolean;
  includeUppercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
}

export const DEFAULT_GENERATOR_OPTIONS: PasswordGeneratorOptions = {
  length: 16,
  includeLowercase: true,
  includeUppercase: true,
  includeNumbers: true,
  includeSymbols: true,
};

/**
 * Generate a random password based on options
 */
export function generatePassword(options: PasswordGeneratorOptions = DEFAULT_GENERATOR_OPTIONS): string {
  let charset = '';
  const required: string[] = [];

  if (options.includeLowercase) {
    charset += LOWERCASE;
    required.push(secureRandomChar(LOWERCASE));
  }
  if (options.includeUppercase) {
    charset += UPPERCASE;
    required.push(secureRandomChar(UPPERCASE));
  }
  if (options.includeNumbers) {
    charset += NUMBERS;
    required.push(secureRandomChar(NUMBERS));
  }
  if (options.includeSymbols) {
    charset += SYMBOLS;
    required.push(secureRandomChar(SYMBOLS));
  }

  if (charset.length === 0) {
    charset = LOWERCASE + UPPERCASE + NUMBERS;
  }

  const length = Math.max(options.length, required.length);
  const passwordChars: string[] = [...required];

  for (let i = passwordChars.length; i < length; i++) {
    passwordChars.push(secureRandomChar(charset));
  }

  // Cryptographically secure Fisher-Yates shuffle so required characters
  // aren't predictably positioned at the front.
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
}

/**
 * Calculate password strength score (0-4)
 * 0 = Very Weak, 1 = Weak, 2 = Fair, 3 = Good, 4 = Strong
 */
export function calculatePasswordStrength(password: string): number {
  if (!password) return 0;

  let score = 0;

  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  const variety = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  if (variety >= 3) score++;
  if (variety >= 4) score++;

  // Cap at 4
  return Math.min(4, score);
}

/**
 * Get strength label from score
 */
export function getStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Very Weak';
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Good';
    case 4:
      return 'Strong';
    default:
      return 'Unknown';
  }
}

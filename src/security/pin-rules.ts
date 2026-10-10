/**
 * Rules for choosing a new PIN or passphrase. Existing PINs are never
 * rejected; these checks only run when one is being set.
 */

const COMMON_PINS = new Set([
  '1212',
  '6969',
  '2580',
  '1004',
  '2000',
  '1122',
  '1313',
  '4444',
  '7777',
  '5555',
  '112233',
  '121212',
  '123123',
  '696969',
  '101010',
  '159753',
  '147258',
  '258369',
  '131313',
  '159357',
  '753951',
  '102030',
  '111222',
  '252525',
  '007007',
]);

function isRepeated(pin: string): boolean {
  return /^(\d)\1+$/.test(pin);
}

function isSequence(pin: string): boolean {
  const steps = new Set<number>();
  for (let i = 1; i < pin.length; i++) {
    steps.add((Number(pin[i]) - Number(pin[i - 1]) + 10) % 10);
  }
  // Every step +1 (1234, 7890) or every step -1 (4321, 3210).
  return steps.size === 1 && (steps.has(1) || steps.has(9));
}

function isPattern(pin: string): boolean {
  // Two-digit blocks repeated: 1212, 123123 is covered below, 101010.
  if (pin.length % 2 === 0 && pin === pin.slice(0, 2).repeat(pin.length / 2)) return true;
  if (pin.length === 6 && pin.slice(0, 3) === pin.slice(3)) return true;
  return false;
}

function isYear(pin: string): boolean {
  if (pin.length !== 4) return false;
  const n = Number(pin);
  return n >= 1940 && n <= 2039;
}

/** Why a PIN is too easy to guess, or null when it's fine. */
export function weakPinReason(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'Use digits only.';
  if (isRepeated(pin)) return 'Avoid repeating one digit.';
  if (isSequence(pin)) return 'Avoid counting up or down.';
  if (isPattern(pin) || COMMON_PINS.has(pin)) return 'That PIN is one of the most guessed.';
  if (isYear(pin)) return 'Avoid years; they are easy to guess.';
  return null;
}

export const MIN_PASSPHRASE_LENGTH = 10;

/** Why a passphrase is too weak to protect the vault, or null when it's fine. */
export function weakPassphraseReason(passphrase: string): string | null {
  if (passphrase.trim().length < MIN_PASSPHRASE_LENGTH) {
    return `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  }
  if (/^(.)\1+$/.test(passphrase)) return 'Avoid repeating one character.';
  return null;
}

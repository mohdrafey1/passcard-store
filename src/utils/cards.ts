/**
 * Card number rules: network detection by prefix (IIN), Luhn check, display
 * grouping, and expiry. Pure functions; card data never leaves the device.
 */

export type NetworkId =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'rupay'
  | 'discover'
  | 'diners'
  | 'jcb'
  | 'unionpay'
  | 'maestro'
  | 'unknown';

export interface CardNetwork {
  id: NetworkId;
  name: string;
  /** Valid total lengths. */
  lengths: number[];
  cvvLength: number;
  /** Positions after which a space is shown. */
  gaps: number[];
}

const inRange = (digits: string, len: number, min: number, max: number): boolean => {
  if (digits.length < len) return false;
  const n = Number(digits.slice(0, len));
  return n >= min && n <= max;
};

const STANDARD_GAPS = [4, 8, 12, 16];

const NETWORKS: (CardNetwork & { test: (d: string) => boolean })[] = [
  { id: 'amex', name: 'Amex', lengths: [15], cvvLength: 4, gaps: [4, 10], test: (d) => /^3[47]/.test(d) },
  {
    id: 'diners',
    name: 'Diners Club',
    lengths: [14, 16, 19],
    cvvLength: 3,
    gaps: [4, 10],
    test: (d) => /^3(0[0-5]|[689])/.test(d),
  },
  { id: 'jcb', name: 'JCB', lengths: [16, 17, 18, 19], cvvLength: 3, gaps: STANDARD_GAPS, test: (d) => inRange(d, 4, 3528, 3589) },
  {
    id: 'rupay',
    name: 'RuPay',
    lengths: [16],
    cvvLength: 3,
    gaps: STANDARD_GAPS,
    test: (d) =>
      inRange(d, 6, 508500, 508999) ||
      inRange(d, 6, 606985, 607984) ||
      inRange(d, 6, 608001, 608500) ||
      inRange(d, 6, 652150, 653149) ||
      inRange(d, 6, 817200, 820199),
  },
  {
    id: 'discover',
    name: 'Discover',
    lengths: [16, 17, 18, 19],
    cvvLength: 3,
    gaps: STANDARD_GAPS,
    test: (d) => /^(6011|65|64[4-9])/.test(d) || inRange(d, 6, 622126, 622925),
  },
  { id: 'unionpay', name: 'UnionPay', lengths: [16, 17, 18, 19], cvvLength: 3, gaps: STANDARD_GAPS, test: (d) => /^62/.test(d) },
  {
    id: 'mastercard',
    name: 'Mastercard',
    lengths: [16],
    cvvLength: 3,
    gaps: STANDARD_GAPS,
    test: (d) => /^5[1-5]/.test(d) || inRange(d, 4, 2221, 2720),
  },
  {
    id: 'maestro',
    name: 'Maestro',
    lengths: [12, 13, 14, 15, 16, 17, 18, 19],
    cvvLength: 3,
    gaps: STANDARD_GAPS,
    test: (d) => /^(5018|5020|5038|5893|6304|6759|676[1-3])/.test(d),
  },
  { id: 'visa', name: 'Visa', lengths: [13, 16, 19], cvvLength: 3, gaps: STANDARD_GAPS, test: (d) => /^4/.test(d) },
];

const UNKNOWN: CardNetwork = {
  id: 'unknown',
  name: 'Card',
  lengths: [12, 13, 14, 15, 16, 17, 18, 19],
  cvvLength: 3,
  gaps: STANDARD_GAPS,
};

export const MAX_CARD_DIGITS = 19;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function detectNetwork(number: string): CardNetwork {
  const d = digitsOnly(number);
  const match = NETWORKS.find((n) => n.test(d));
  if (!match) return UNKNOWN;
  const { test: _test, ...network } = match;
  return network;
}

/** Group digits for display: 4-4-4-4 (and 3 more for 19), Amex 4-6-5. */
export function formatCardNumber(number: string): string {
  const d = digitsOnly(number).slice(0, MAX_CARD_DIGITS);
  const { gaps } = detectNetwork(d);
  let out = '';
  for (let i = 0; i < d.length; i++) {
    if (i > 0 && gaps.includes(i)) out += ' ';
    out += d[i];
  }
  return out;
}

/** "•••• 4471" */
export function maskCardNumber(number: string): string {
  const d = digitsOnly(number);
  return d.length >= 4 ? `•••• ${d.slice(-4)}` : '••••';
}

export function luhnValid(number: string): boolean {
  const d = digitsOnly(number);
  if (d.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export interface CardNumberCheck {
  network: CardNetwork;
  /** Length matches the network. */
  complete: boolean;
  luhn: boolean;
  /** What's wrong, for display; null when the number looks right. */
  problem: string | null;
}

export function checkCardNumber(number: string): CardNumberCheck {
  const d = digitsOnly(number);
  const network = detectNetwork(d);
  const complete = network.lengths.includes(d.length);
  const luhn = luhnValid(d);
  let problem: string | null = null;
  if (d.length === 0) problem = 'Enter the card number.';
  else if (!complete) {
    const lens = network.lengths;
    problem =
      network.id === 'unknown'
        ? 'Card numbers are 12 to 19 digits.'
        : `${network.name} numbers are ${lens.length === 1 ? lens[0] : `${lens[0]}–${lens[lens.length - 1]}`} digits.`;
  } else if (!luhn) problem = 'This number fails the card check. Look for a typo.';
  return { network, complete, luhn, problem };
}

export type ExpiryState = 'valid' | 'expiring' | 'expired' | 'invalid';

export const EXPIRING_SOON_DAYS = 60;

/** Last moment the card is valid: the end of its expiry month. */
export function expiryEnd(month: string, year: string): Date | null {
  const m = Number(month);
  const y = Number(year);
  if (!/^\d{1,2}$/.test(month) || !/^\d{2}$/.test(year) || m < 1 || m > 12) return null;
  return new Date(2000 + y, m, 0, 23, 59, 59);
}

export function expiryState(month: string, year: string, now: Date = new Date()): ExpiryState {
  const end = expiryEnd(month, year);
  if (!end) return 'invalid';
  if (end.getTime() < now.getTime()) return 'expired';
  const daysLeft = (end.getTime() - now.getTime()) / 86_400_000;
  return daysLeft <= EXPIRING_SOON_DAYS ? 'expiring' : 'valid';
}

export function formatExpiry(month: string, year: string): string {
  if (!month && !year) return '';
  return `${month.padStart(2, '0')}/${year}`;
}

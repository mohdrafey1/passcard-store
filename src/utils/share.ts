import { Share } from 'react-native';
import type { PasswordEntry } from '@/types/password';
import type { CardEntry } from '@/types/card';
import { runWithoutAutoLock } from '@/utils/auto-lock-guard';

/**
 * Sharing sends text to another app, outside the vault. Secrets (password,
 * full card number, CVV) are left out unless the caller explicitly asks after
 * confirming with the user.
 */

export function formatPasswordAsText(entry: PasswordEntry, includeSecret = false): string {
  const lines: string[] = [];
  if (entry.title) lines.push(`Title: ${entry.title}`);
  if (entry.website) lines.push(`Website: ${entry.website}`);
  if (entry.username) lines.push(`Username: ${entry.username}`);
  if (entry.email) lines.push(`Email: ${entry.email}`);
  if (includeSecret && entry.password) lines.push(`Password: ${entry.password}`);
  return lines.join('\n');
}

export function formatCardAsText(entry: CardEntry, includeSecret = false): string {
  const lines: string[] = [];
  if (entry.cardNickname) lines.push(`Card: ${entry.cardNickname}`);
  if (entry.cardHolderName) lines.push(`Holder: ${entry.cardHolderName}`);
  if (entry.cardNumber) {
    lines.push(`Number: ${includeSecret ? entry.cardNumber : `•••• ${entry.cardNumber.slice(-4)}`}`);
  }
  if (entry.expiryMonth && entry.expiryYear) lines.push(`Expiry: ${entry.expiryMonth}/${entry.expiryYear}`);
  if (includeSecret && entry.cvv) lines.push(`CVV: ${entry.cvv}`);
  return lines.join('\n');
}

/** Share as plain text through the system share sheet (no file is written). */
export async function shareText(message: string): Promise<void> {
  await runWithoutAutoLock(() => Share.share({ message }));
}

export function sharePassword(entry: PasswordEntry, includeSecret = false): Promise<void> {
  return shareText(formatPasswordAsText(entry, includeSecret));
}

export function shareCard(entry: CardEntry, includeSecret = false): Promise<void> {
  return shareText(formatCardAsText(entry, includeSecret));
}

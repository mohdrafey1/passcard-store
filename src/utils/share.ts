import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { PasswordEntry } from '@/types/password';
import type { CardEntry } from '@/types/card';

/**
 * Format a password entry as shareable plain text
 */
export function formatPasswordAsText(entry: PasswordEntry): string {
  const lines: string[] = [];
  if (entry.title) lines.push(`Title: ${entry.title}`);
  if (entry.website) lines.push(`Website: ${entry.website}`);
  if (entry.username) lines.push(`Username: ${entry.username}`);
  if (entry.email) lines.push(`Email: ${entry.email}`);
  if (entry.password) lines.push(`Password: ${entry.password}`);
  if (entry.notes) lines.push(`Notes: ${entry.notes}`);
  return lines.join('\n');
}

/**
 * Format a card entry as shareable plain text
 */
export function formatCardAsText(entry: CardEntry): string {
  const lines: string[] = [];
  if (entry.cardNickname) lines.push(`Card: ${entry.cardNickname}`);
  if (entry.cardHolderName) lines.push(`Holder: ${entry.cardHolderName}`);
  if (entry.cardNumber) lines.push(`Number: ${entry.cardNumber}`);
  if (entry.expiryMonth && entry.expiryYear) {
    lines.push(`Expiry: ${entry.expiryMonth}/${entry.expiryYear}`);
  }
  if (entry.cvv) lines.push(`CVV: ${entry.cvv}`);
  if (entry.notes) lines.push(`Notes: ${entry.notes}`);
  return lines.join('\n');
}

/**
 * Share text content via native share sheet
 */
export async function shareText(text: string, filename = 'passcard-share.txt'): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

  const file = new File(Paths.cache, filename);
  file.write(text);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/plain',
    dialogTitle: 'Share from Passcard Store',
  });
}

/**
 * Share a password entry via native share sheet
 */
export async function sharePassword(entry: PasswordEntry): Promise<void> {
  const text = formatPasswordAsText(entry);
  await shareText(text, `password-${entry.title.replace(/\s+/g, '-')}.txt`);
}

/**
 * Share a card entry via native share sheet
 */
export async function shareCard(entry: CardEntry): Promise<void> {
  const text = formatCardAsText(entry);
  await shareText(text, `card-${entry.cardNickname.replace(/\s+/g, '-')}.txt`);
}

/**
 * Share multiple items at once
 */
export async function shareMultiple(
  passwords: PasswordEntry[],
  cards: CardEntry[],
): Promise<void> {
  const sections: string[] = [];

  if (passwords.length > 0) {
    sections.push('=== PASSWORDS ===');
    passwords.forEach((p) => {
      sections.push(formatPasswordAsText(p));
      sections.push('---');
    });
  }

  if (cards.length > 0) {
    sections.push('=== CARDS ===');
    cards.forEach((c) => {
      sections.push(formatCardAsText(c));
      sections.push('---');
    });
  }

  await shareText(sections.join('\n'), 'passcard-export.txt');
}

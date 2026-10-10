import * as Clipboard from 'expo-clipboard';

let clearTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: string | null = null;

async function clearIfStillOurs(): Promise<void> {
  const ours = pendingValue;
  pendingValue = null;
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  if (ours === null) return;
  try {
    // Leave something the user copied afterwards alone. Android blocks reads
    // in the background; then we clear anyway, since it may still be ours.
    const current = await Clipboard.getStringAsync();
    if (current && current !== ours) return;
  } catch {
    // fall through to clearing
  }
  await Clipboard.setStringAsync('').catch(() => {});
}

/**
 * Copy a secret and clear it after `clearAfterSeconds`, unless something else
 * has been copied since.
 */
export async function copyToClipboard(text: string, clearAfterSeconds?: number): Promise<void> {
  await Clipboard.setStringAsync(text);
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  pendingValue = null;
  if (clearAfterSeconds && clearAfterSeconds > 0) {
    pendingValue = text;
    clearTimer = setTimeout(() => void clearIfStillOurs(), clearAfterSeconds * 1000);
  }
}

/** Clear a copied secret now (used when the vault locks). */
export async function clearPendingClipboard(): Promise<void> {
  await clearIfStillOurs();
}

import * as Clipboard from 'expo-clipboard';

let clearTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Copy text to clipboard with auto-clear after specified duration
 */
export async function copyToClipboard(
  text: string,
  clearAfterSeconds?: number,
): Promise<void> {
  await Clipboard.setStringAsync(text);

  // Clear any existing timer
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }

  // Set auto-clear if duration specified
  if (clearAfterSeconds && clearAfterSeconds > 0) {
    clearTimer = setTimeout(async () => {
      await Clipboard.setStringAsync('');
      clearTimer = null;
    }, clearAfterSeconds * 1000);
  }
}

/**
 * Clear the clipboard immediately
 */
export async function clearClipboard(): Promise<void> {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  await Clipboard.setStringAsync('');
}

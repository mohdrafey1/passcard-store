import * as Clipboard from 'expo-clipboard';
import SensitiveClipboard from './src/SensitiveClipboardModule';

/**
 * Copy a secret. On Android it's flagged as sensitive so the system clipboard
 * preview shows dots instead of the value; elsewhere it's a normal copy.
 */
export async function setSensitiveStringAsync(text: string): Promise<void> {
  if (SensitiveClipboard) {
    await SensitiveClipboard.setSensitiveStringAsync(text);
    return;
  }
  await Clipboard.setStringAsync(text);
}

/** Empty the clipboard. */
export async function clearClipboardAsync(): Promise<void> {
  if (SensitiveClipboard) {
    await SensitiveClipboard.clearAsync();
    return;
  }
  await Clipboard.setStringAsync('');
}

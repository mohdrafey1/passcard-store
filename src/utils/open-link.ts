import * as WebBrowser from 'expo-web-browser';
import { runWithoutAutoLock } from '@/utils/auto-lock-guard';

/**
 * Open an informational page (privacy policy, terms) in an in-app browser
 * tab. The vault stays unlocked while it's open, since the user never left.
 */
export function openInfoPage(url: string): Promise<unknown> {
  return runWithoutAutoLock(() => WebBrowser.openBrowserAsync(url)).catch(() => undefined);
}

import { Paths, Directory, File } from 'expo-file-system';

/**
 * Temporary export/share files are written to the cache directory so the OS
 * share sheet can read them. Several of them (CSV, plain-text shares) contain
 * *decrypted* secrets, so they must not be left lying around. These helpers
 * remove them promptly.
 */

const TEMP_PREFIXES = ['password-', 'card-', 'passcard-'];
const TEMP_SUFFIXES = ['.csv', '.vaultx', '.txt'];

function isTempExportFile(name: string): boolean {
  return (
    TEMP_SUFFIXES.some((s) => name.endsWith(s)) ||
    TEMP_PREFIXES.some((p) => name.startsWith(p))
  );
}

/**
 * Delete a single temp file by URI (best effort). Call after a share completes.
 */
export function cleanupTempFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Ignore — cleanup is best effort.
  }
}

/**
 * Remove any leftover export/share temp files from the cache directory.
 * Safe to call on every app launch.
 */
export function purgeExportCache(): void {
  try {
    const cache = new Directory(Paths.cache);
    if (!cache.exists) return;
    for (const entry of cache.list()) {
      if (entry instanceof File && isTempExportFile(entry.name)) {
        try {
          entry.delete();
        } catch {
          // Ignore individual failures.
        }
      }
    }
  } catch {
    // Ignore — cleanup is best effort.
  }
}

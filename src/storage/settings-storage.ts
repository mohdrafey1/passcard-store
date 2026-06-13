import * as SecureStore from 'expo-secure-store';
import type { AppSettings, AutoLockDuration, ClipboardClearDuration } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

const SETTINGS_KEYS = {
  biometricsEnabled: 'SETTINGS_BIOMETRICS_ENABLED',
  autoLockDuration: 'SETTINGS_AUTO_LOCK_DURATION',
  clipboardClearDuration: 'SETTINGS_CLIPBOARD_CLEAR_DURATION',
  pinLength: 'SETTINGS_PIN_LENGTH',
} as const;

/**
 * Load all settings from secure store
 */
export async function loadSettings(): Promise<AppSettings> {
  const [biometrics, autoLock, clipboardClear, pinLength] = await Promise.all([
    SecureStore.getItemAsync(SETTINGS_KEYS.biometricsEnabled),
    SecureStore.getItemAsync(SETTINGS_KEYS.autoLockDuration),
    SecureStore.getItemAsync(SETTINGS_KEYS.clipboardClearDuration),
    SecureStore.getItemAsync(SETTINGS_KEYS.pinLength),
  ]);

  return {
    biometricsEnabled: biometrics === 'true',
    autoLockDuration: autoLock
      ? (parseInt(autoLock, 10) as AutoLockDuration)
      : DEFAULT_SETTINGS.autoLockDuration,
    clipboardClearDuration: clipboardClear
      ? (parseInt(clipboardClear, 10) as ClipboardClearDuration)
      : DEFAULT_SETTINGS.clipboardClearDuration,
    pinLength: pinLength === '6' ? 6 : 4,
  };
}

/**
 * Save a single setting
 */
export async function saveSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  await SecureStore.setItemAsync(SETTINGS_KEYS[key], String(value));
}

/**
 * Delete all settings (used during full data wipe)
 */
export async function deleteAllSettings(): Promise<void> {
  await Promise.all(
    Object.values(SETTINGS_KEYS).map((key) => SecureStore.deleteItemAsync(key)),
  );
}

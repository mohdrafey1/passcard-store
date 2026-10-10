import * as SecureStore from 'expo-secure-store';
import {
  AUTO_LOCK_OPTIONS,
  BACKUP_REMINDER_OPTIONS,
  CLIPBOARD_CLEAR_OPTIONS,
  DEFAULT_SETTINGS,
  THEME_OPTIONS,
  type AppSettings,
} from '@/types/settings';

const KEYS: Record<keyof AppSettings, string> = {
  autoLockDuration: 'SETTINGS_AUTO_LOCK_DURATION',
  clipboardClearDuration: 'SETTINGS_CLIPBOARD_CLEAR_DURATION',
  wipeAfterFailures: 'SETTINGS_WIPE_AFTER_FAILURES',
  theme: 'SETTINGS_THEME',
  backupReminder: 'SETTINGS_BACKUP_REMINDER',
  lastBackupAt: 'SETTINGS_LAST_BACKUP_AT',
  categories: 'SETTINGS_CATEGORIES',
};

// Written by v1.0–v1.1. Fingerprint state and PIN length now live with the
// vault key (see key-manager).
const LEGACY_BIOMETRICS = 'SETTINGS_BIOMETRICS_ENABLED';
const LEGACY_PIN_LENGTH = 'SETTINGS_PIN_LENGTH';

function pick<T>(raw: string | null, allowed: readonly { value: T }[], fallback: T, parse: (s: string) => T): T {
  if (raw === null) return fallback;
  const value = parse(raw);
  return allowed.some((o) => o.value === value) ? value : fallback;
}

export function sanitizeCategories(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const name = v.trim().slice(0, 30);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out.length > 0 ? out.slice(0, 40) : null;
}

export async function loadSettings(): Promise<AppSettings> {
  const entries = await Promise.all(
    (Object.keys(KEYS) as (keyof AppSettings)[]).map(
      async (k) => [k, await SecureStore.getItemAsync(KEYS[k]).catch(() => null)] as const,
    ),
  );
  const raw = Object.fromEntries(entries) as Record<keyof AppSettings, string | null>;

  let categories = DEFAULT_SETTINGS.categories;
  if (raw.categories) {
    try {
      categories = sanitizeCategories(JSON.parse(raw.categories)) ?? categories;
    } catch {
      // keep defaults
    }
  }

  return {
    autoLockDuration: pick(raw.autoLockDuration, AUTO_LOCK_OPTIONS, DEFAULT_SETTINGS.autoLockDuration, (s) =>
      parseInt(s, 10) as AppSettings['autoLockDuration'],
    ),
    clipboardClearDuration: pick(
      raw.clipboardClearDuration,
      CLIPBOARD_CLEAR_OPTIONS,
      DEFAULT_SETTINGS.clipboardClearDuration,
      (s) => parseInt(s, 10) as AppSettings['clipboardClearDuration'],
    ),
    wipeAfterFailures: raw.wipeAfterFailures === 'true',
    theme: pick(raw.theme, THEME_OPTIONS, DEFAULT_SETTINGS.theme, (s) => s as AppSettings['theme']),
    backupReminder: pick(raw.backupReminder, BACKUP_REMINDER_OPTIONS, DEFAULT_SETTINGS.backupReminder, (s) =>
      s as AppSettings['backupReminder'],
    ),
    lastBackupAt: raw.lastBackupAt && !Number.isNaN(Date.parse(raw.lastBackupAt)) ? raw.lastBackupAt : null,
    categories,
  };
}

export async function saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  if (value === null) {
    await SecureStore.deleteItemAsync(KEYS[key]);
    return;
  }
  await SecureStore.setItemAsync(KEYS[key], Array.isArray(value) ? JSON.stringify(value) : String(value));
}

/**
 * Whether fingerprint unlock was on in v1.0–v1.1 (it defaulted to on, so a
 * missing value means on). Removes the old keys; returns null when there was
 * nothing to migrate.
 */
export async function takeLegacyBiometricPreference(): Promise<boolean | null> {
  const value = await SecureStore.getItemAsync(LEGACY_BIOMETRICS).catch(() => null);
  await SecureStore.deleteItemAsync(LEGACY_BIOMETRICS).catch(() => {});
  await SecureStore.deleteItemAsync(LEGACY_PIN_LENGTH).catch(() => {});
  return value === null ? null : value !== 'false';
}

export async function deleteAllSettings(): Promise<void> {
  await Promise.all(
    [...Object.values(KEYS), LEGACY_BIOMETRICS, LEGACY_PIN_LENGTH].map((key) =>
      SecureStore.deleteItemAsync(key).catch(() => {}),
    ),
  );
}

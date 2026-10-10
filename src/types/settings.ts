export type AutoLockDuration = 0 | 30 | 60 | 300 | 900;

export type ClipboardClearDuration = 15 | 30 | 60 | 120;

export type ThemePreference = 'system' | 'midnight' | 'paper';

export type BackupReminder = 'off' | 'weekly' | 'monthly';

export interface AppSettings {
  autoLockDuration: AutoLockDuration;
  clipboardClearDuration: ClipboardClearDuration;
  /** Erase the vault after 10 wrong PINs in a row. */
  wipeAfterFailures: boolean;
  theme: ThemePreference;
  backupReminder: BackupReminder;
  lastBackupAt: string | null;
  categories: string[];
}

export const DEFAULT_CATEGORIES = ['Personal', 'Work', 'Banking', 'Shopping', 'Social', 'Entertainment', 'Education', 'Other'];

export const DEFAULT_SETTINGS: AppSettings = {
  autoLockDuration: 0,
  clipboardClearDuration: 30,
  wipeAfterFailures: false,
  theme: 'system',
  backupReminder: 'monthly',
  lastBackupAt: null,
  categories: DEFAULT_CATEGORIES,
};

export const AUTO_LOCK_OPTIONS: { label: string; value: AutoLockDuration }[] = [
  { label: 'Immediately', value: 0 },
  { label: 'After 30 seconds', value: 30 },
  { label: 'After 1 minute', value: 60 },
  { label: 'After 5 minutes', value: 300 },
  { label: 'After 15 minutes', value: 900 },
];

export const CLIPBOARD_CLEAR_OPTIONS: { label: string; value: ClipboardClearDuration }[] = [
  { label: 'After 15 seconds', value: 15 },
  { label: 'After 30 seconds', value: 30 },
  { label: 'After 1 minute', value: 60 },
  { label: 'After 2 minutes', value: 120 },
];

export const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'Match system', value: 'system' },
  { label: 'Midnight (dark)', value: 'midnight' },
  { label: 'Paper (light)', value: 'paper' },
];

export const BACKUP_REMINDER_OPTIONS: { label: string; value: BackupReminder; days: number | null }[] = [
  { label: 'Monthly', value: 'monthly', days: 30 },
  { label: 'Weekly', value: 'weekly', days: 7 },
  { label: 'Off', value: 'off', days: null },
];

export type AutoLockDuration = 0 | 30 | 60 | 300 | 900;

export type ClipboardClearDuration = 15 | 30 | 60;

export interface AppSettings {
  biometricsEnabled: boolean;
  autoLockDuration: AutoLockDuration;
  clipboardClearDuration: ClipboardClearDuration;
  pinLength: 4 | 6;
}

export const DEFAULT_SETTINGS: AppSettings = {
  biometricsEnabled: false,
  autoLockDuration: 0,
  clipboardClearDuration: 30,
  pinLength: 4,
};

export const AUTO_LOCK_OPTIONS: { label: string; value: AutoLockDuration }[] = [
  { label: 'Immediate', value: 0 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '15 minutes', value: 900 },
];

export const CLIPBOARD_CLEAR_OPTIONS: { label: string; value: ClipboardClearDuration }[] = [
  { label: '15 seconds', value: 15 },
  { label: '30 seconds', value: 30 },
  { label: '60 seconds', value: 60 },
];

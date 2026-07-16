import { create } from 'zustand';
import type { AppSettings, AutoLockDuration, ClipboardClearDuration } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { loadSettings, saveSetting, deleteAllSettings } from '@/storage/settings-storage';
import { isPinSetup } from '@/security/pin';
import { enableBiometricKey, disableBiometricKey } from '@/security/key-manager';

interface AuthState {
  isAuthenticated: boolean;
  isPinCreated: boolean;
  isInitialized: boolean;
}

interface SettingsState extends AppSettings, AuthState {
  // Auth actions
  initialize: () => Promise<void>;
  setAuthenticated: (value: boolean) => void;
  // Settings actions
  loadSettings: () => Promise<void>;
  setBiometrics: (enabled: boolean) => Promise<void>;
  setAutoLockDuration: (duration: AutoLockDuration) => Promise<void>;
  setClipboardClearDuration: (duration: ClipboardClearDuration) => Promise<void>;
  resetAll: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  // Default settings
  ...DEFAULT_SETTINGS,
  // Auth state
  isAuthenticated: false,
  isPinCreated: false,
  isInitialized: false,

  initialize: async () => {
    const pinCreated = await isPinSetup();
    const settings = await loadSettings();
    set({
      isPinCreated: pinCreated,
      isInitialized: true,
      ...settings,
    });
  },

  setAuthenticated: (value: boolean) => {
    set({ isAuthenticated: value });
  },

  loadSettings: async () => {
    const settings = await loadSettings();
    set(settings);
  },

  setBiometrics: async (enabled: boolean) => {
    // Provision (or remove) the biometric-accessible copy of the data key so
    // biometric unlock can recover it without the PIN.
    if (enabled) {
      await enableBiometricKey();
    } else {
      await disableBiometricKey();
    }
    await saveSetting('biometricsEnabled', enabled);
    set({ biometricsEnabled: enabled });
  },

  setAutoLockDuration: async (duration: AutoLockDuration) => {
    await saveSetting('autoLockDuration', duration);
    set({ autoLockDuration: duration });
  },

  setClipboardClearDuration: async (duration: ClipboardClearDuration) => {
    await saveSetting('clipboardClearDuration', duration);
    set({ clipboardClearDuration: duration });
  },

  resetAll: async () => {
    await deleteAllSettings();
    set({
      ...DEFAULT_SETTINGS,
      isAuthenticated: false,
      isPinCreated: false,
    });
  },
}));

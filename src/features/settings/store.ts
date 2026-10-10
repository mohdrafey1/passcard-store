import { create } from 'zustand';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';
import { loadSettings, saveSetting, takeLegacyBiometricPreference } from '@/storage/settings-storage';
import {
  disableBiometricUnlock,
  enableBiometricUnlock,
  getUnlockInfo,
  hasVault,
  isBiometricUnlockEnabled,
  migrateLegacyBiometrics,
  type UnlockMethod,
} from '@/security/key-manager';
import { isBiometricAvailable } from '@/security/biometrics';

interface SecurityState {
  isInitialized: boolean;
  hasVault: boolean;
  isAuthenticated: boolean;
  unlockMethod: UnlockMethod;
  /** Digits for a PIN vault; null for a passphrase. */
  pinLength: 4 | 6 | null;
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;
}

interface SettingsState extends AppSettings, SecurityState {
  initialize: () => Promise<void>;
  /** Re-read unlock method and fingerprint state after they change. */
  refreshSecurity: () => Promise<void>;
  setAuthenticated: (value: boolean) => void;
  setHasVault: (value: boolean) => void;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  /** Turning on shows the system fingerprint prompt and throws if cancelled. */
  setBiometrics: (enabled: boolean) => Promise<void>;
  resetToDefaults: () => void;
}

const INITIAL_SECURITY: SecurityState = {
  isInitialized: false,
  hasVault: false,
  isAuthenticated: false,
  unlockMethod: 'pin',
  pinLength: 6,
  biometricsEnabled: false,
  biometricsAvailable: false,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  ...INITIAL_SECURITY,

  initialize: async () => {
    const legacyPreference = await takeLegacyBiometricPreference();
    await migrateLegacyBiometrics(legacyPreference ?? true);
    const [vault, settings] = await Promise.all([hasVault(), loadSettings()]);
    set({ ...settings, hasVault: vault });
    await get().refreshSecurity();
    set({ isInitialized: true });
  },

  refreshSecurity: async () => {
    const vault = await hasVault();
    const [info, bioEnabled, bioAvailable] = await Promise.all([
      vault ? getUnlockInfo() : Promise.resolve({ method: 'pin' as const, pinLength: 6 as const }),
      isBiometricUnlockEnabled(),
      isBiometricAvailable(),
    ]);
    set({
      hasVault: vault,
      unlockMethod: info.method,
      pinLength: info.pinLength,
      biometricsEnabled: bioEnabled && bioAvailable,
      biometricsAvailable: bioAvailable,
    });
  },

  setAuthenticated: (value) => set({ isAuthenticated: value }),

  setHasVault: (value) => set({ hasVault: value }),

  update: async (key, value) => {
    await saveSetting(key, value);
    set({ [key]: value } as Partial<SettingsState>);
  },

  setBiometrics: async (enabled) => {
    if (enabled) {
      await enableBiometricUnlock();
    } else {
      await disableBiometricUnlock();
    }
    set({ biometricsEnabled: enabled });
  },

  // Whether the phone has a fingerprint is about the device, not the vault: keep it
  // so onboarding can offer fingerprint unlock again right after an erase.
  resetToDefaults: () =>
    set({ ...DEFAULT_SETTINGS, ...INITIAL_SECURITY, isInitialized: true, biometricsAvailable: get().biometricsAvailable }),
}));

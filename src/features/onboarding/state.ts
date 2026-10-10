import { create } from 'zustand';
import type { BackupPayload } from '@/features/import-export/backup-handler';
import type { UnlockMethod } from '@/security/key-manager';

/**
 * Choices made across the onboarding screens, kept in memory only until the
 * vault is created. A backup chosen before setup is held here decrypted, and
 * written into the new vault right after it is created.
 */
interface OnboardingState {
  method: UnlockMethod;
  pinLength: 4 | 6;
  fingerprint: boolean;
  pendingRestore: BackupPayload | null;
  setChoice: (c: Partial<Pick<OnboardingState, 'method' | 'pinLength' | 'fingerprint'>>) => void;
  setPendingRestore: (payload: BackupPayload | null) => void;
  reset: () => void;
}

export const useOnboarding = create<OnboardingState>((set) => ({
  method: 'pin',
  pinLength: 6,
  fingerprint: true,
  pendingRestore: null,
  setChoice: (c) => set(c),
  setPendingRestore: (payload) => set({ pendingRestore: payload }),
  reset: () => set({ method: 'pin', pinLength: 6, fingerprint: true, pendingRestore: null }),
}));

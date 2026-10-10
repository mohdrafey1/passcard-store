import { useCardStore } from '@/features/cards/store';
import { usePasswordStore } from '@/features/passwords/store';
import { useSettingsStore } from '@/features/settings/store';
import { clearBackupPassword } from '@/features/import-export/backup-handler';
import { lockSession, verifySecret, wipeKeys } from '@/security/key-manager';
import {
  formatDuration,
  recordFailure,
  recordSuccess,
  resetLockoutState,
  getLockoutStatus,
  WIPE_THRESHOLD,
} from '@/security/lockout';
import { cardRepository } from '@/storage/card-repository';
import { deleteDatabase } from '@/storage/database';
import { passwordRepository } from '@/storage/password-repository';
import { deleteAllSettings } from '@/storage/settings-storage';
import { clearPendingClipboard } from '@/utils/clipboard';

export const RECENTLY_DELETED_DAYS = 30;

/**
 * Everything that follows a correct PIN, passphrase or fingerprint: reset the
 * lockout, upgrade any v1.0–v1.1 rows, purge old deleted items, load the
 * vault and show it.
 */
export async function completeUnlock(): Promise<void> {
  await recordSuccess();
  try {
    await passwordRepository.migrateLegacyRows();
    await cardRepository.migrateLegacyRows();
  } catch (e) {
    // Old-format rows stay readable; the upgrade retries on the next unlock.
    if (__DEV__) console.warn('Record upgrade failed', e);
  }
  const cutoff = new Date(Date.now() - RECENTLY_DELETED_DAYS * 86_400_000);
  await Promise.all([passwordRepository.purgeDeleted(cutoff), cardRepository.purgeDeleted(cutoff)]).catch(() => {});
  await Promise.all([usePasswordStore.getState().load(), useCardStore.getState().load()]);
  useSettingsStore.getState().setAuthenticated(true);
}

/** Lock: forget the key and every decrypted item, and clear a pending copy. */
export function lockVault(): void {
  lockSession();
  usePasswordStore.getState().reset();
  useCardStore.getState().reset();
  void clearPendingClipboard();
  useSettingsStore.getState().setAuthenticated(false);
}

/** Permanently delete the vault, its keys and all settings on this device. */
export async function eraseVault(): Promise<void> {
  lockVault();
  await wipeKeys();
  await deleteDatabase();
  await deleteAllSettings();
  await resetLockoutState();
  await clearBackupPassword();
  useSettingsStore.getState().resetToDefaults();
}

export interface SecretCheck {
  ok: boolean;
  /** What to show under the PIN pad when not ok. */
  message: string;
  lockedOut: boolean;
  /** The vault was erased by the "erase after 10 tries" setting. */
  erased: boolean;
}

function lockoutMessage(seconds: number): string {
  return `Too many wrong attempts. Try again in ${formatDuration(seconds)}.`;
}

/** Describe the current lockout, if any, for a PIN prompt that just opened. */
export function currentLockoutMessage(): string | null {
  const status = getLockoutStatus();
  return status.lockedOut ? lockoutMessage(status.remainingSeconds) : null;
}

/**
 * Check a PIN/passphrase through the shared lockout. `unlock` runs the actual
 * check (unlocking, or verifying for a re-auth prompt) and returns whether it
 * was correct.
 */
export async function checkSecretWithLockout(
  check: () => Promise<boolean>,
  noun: 'PIN' | 'passphrase',
): Promise<SecretCheck> {
  const before = getLockoutStatus();
  if (before.lockedOut) {
    return { ok: false, message: lockoutMessage(before.remainingSeconds), lockedOut: true, erased: false };
  }
  if (await check()) {
    await recordSuccess();
    return { ok: true, message: '', lockedOut: false, erased: false };
  }
  const status = await recordFailure();
  const { wipeAfterFailures } = useSettingsStore.getState();
  if (wipeAfterFailures && status.totalFailures >= WIPE_THRESHOLD) {
    await eraseVault();
    return { ok: false, message: 'The vault was erased after too many wrong attempts.', lockedOut: false, erased: true };
  }
  if (status.lockedOut) {
    return { ok: false, message: lockoutMessage(status.remainingSeconds), lockedOut: true, erased: false };
  }
  const left = status.attemptsLeft;
  const eraseWarning =
    wipeAfterFailures && WIPE_THRESHOLD - status.totalFailures <= 3
      ? ` The vault is erased after ${WIPE_THRESHOLD - status.totalFailures} more.`
      : '';
  return {
    ok: false,
    message: `Wrong ${noun}. ${left} ${left === 1 ? 'try' : 'tries'} before a pause.${eraseWarning}`,
    lockedOut: false,
    erased: false,
  };
}

/** Re-auth prompts (export, backup password, erase): verify without unlocking. */
export function verifyWithLockout(secret: string, noun: 'PIN' | 'passphrase'): Promise<SecretCheck> {
  return checkSecretWithLockout(() => verifySecret(secret), noun);
}

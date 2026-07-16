import * as SecureStore from 'expo-secure-store';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute
const STORAGE_KEY = 'LOCKOUT_STATE';

interface LockoutState {
  failedAttempts: number;
  lockoutUntil: number | null;
}

let state: LockoutState = {
  failedAttempts: 0,
  lockoutUntil: null,
};

let hydrated = false;

/**
 * Persist the in-memory lockout state so it survives an app restart.
 * Without this, an attacker can reset the failed-attempt counter simply by
 * force-stopping and reopening the app, defeating the lockout entirely.
 */
function persist(): void {
  // Fire-and-forget; a failed write must never block the auth UI.
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

/**
 * Hydrate lockout state from secure storage. Call once on the unlock screen
 * before reading lockout status so a persisted lockout is respected.
 */
export async function initLockout(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LockoutState;
      if (
        typeof parsed.failedAttempts === 'number' &&
        (parsed.lockoutUntil === null || typeof parsed.lockoutUntil === 'number')
      ) {
        state = parsed;
      }
    }
  } catch {
    // Corrupt/absent state — start fresh.
  } finally {
    hydrated = true;
  }
}

/**
 * Check if the app is currently locked out.
 */
export function isLockedOut(): boolean {
  if (state.lockoutUntil === null) return false;
  if (Date.now() >= state.lockoutUntil) {
    resetLockout();
    return false;
  }
  return true;
}

/**
 * Get remaining lockout time in seconds
 */
export function getLockoutRemainingSeconds(): number {
  if (state.lockoutUntil === null) return 0;
  const remaining = Math.max(0, state.lockoutUntil - Date.now());
  return Math.ceil(remaining / 1000);
}

/**
 * Record a failed attempt. Returns true if now locked out.
 */
export function recordFailedAttempt(): boolean {
  state.failedAttempts += 1;
  let lockedNow = false;
  if (state.failedAttempts >= MAX_ATTEMPTS) {
    state.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    lockedNow = true;
  }
  persist();
  return lockedNow;
}

/**
 * Reset lockout state on successful authentication
 */
export function resetLockout(): void {
  state.failedAttempts = 0;
  state.lockoutUntil = null;
  persist();
}

/**
 * Get current failed attempt count
 */
export function getFailedAttempts(): number {
  return state.failedAttempts;
}

/**
 * Get remaining attempts before lockout
 */
export function getRemainingAttempts(): number {
  return Math.max(0, MAX_ATTEMPTS - state.failedAttempts);
}

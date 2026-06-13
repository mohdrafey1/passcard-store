const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute

interface LockoutState {
  failedAttempts: number;
  lockoutUntil: number | null;
}

let state: LockoutState = {
  failedAttempts: 0,
  lockoutUntil: null,
};

/**
 * Check if the app is currently locked out
 */
export function isLockedOut(): boolean {
  if (state.lockoutUntil === null) return false;
  if (Date.now() >= state.lockoutUntil) {
    // Lockout expired, reset
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
  if (state.failedAttempts >= MAX_ATTEMPTS) {
    state.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    return true;
  }
  return false;
}

/**
 * Reset lockout state on successful authentication
 */
export function resetLockout(): void {
  state.failedAttempts = 0;
  state.lockoutUntil = null;
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

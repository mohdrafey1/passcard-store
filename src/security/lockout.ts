import * as SecureStore from 'expo-secure-store';

/**
 * Wrong-PIN rate limiting shared by every PIN/passphrase prompt (unlock,
 * re-auth before export/backup/erase, change PIN).
 *
 * Every 5 wrong attempts start a lockout that grows each round:
 * 1 min → 5 min → 15 min → 1 h (then stays at 1 h). Only a correct entry
 * resets it. State is persisted, so killing the app doesn't reset the count.
 * `totalFailures` feeds the optional "erase after 10 wrong attempts" setting.
 */

const STORAGE_KEY = 'LOCKOUT_STATE';
export const ATTEMPTS_PER_ROUND = 5;
export const LOCKOUT_STEPS_SECONDS = [60, 300, 900, 3600] as const;
export const WIPE_THRESHOLD = 10;

export interface LockoutState {
  /** Wrong attempts in the current round. */
  failedAttempts: number;
  lockoutUntil: number | null;
  /** Lockouts since the last correct entry; picks the next duration. */
  lockouts: number;
  /** Wrong attempts since the last correct entry. */
  totalFailures: number;
}

export interface LockoutStatus {
  lockedOut: boolean;
  remainingSeconds: number;
  attemptsLeft: number;
  totalFailures: number;
}

const INITIAL: LockoutState = { failedAttempts: 0, lockoutUntil: null, lockouts: 0, totalFailures: 0 };

// ---- Pure logic (unit tested) ----

/** Clear an expired lockout so a new round of attempts can begin. */
export function settle(state: LockoutState, now: number): LockoutState {
  if (state.lockoutUntil !== null && now >= state.lockoutUntil) {
    return { ...state, failedAttempts: 0, lockoutUntil: null };
  }
  return state;
}

export function applyFailure(state: LockoutState, now: number): LockoutState {
  const s = settle(state, now);
  if (s.lockoutUntil !== null) return s; // attempts are ignored while locked
  const failedAttempts = s.failedAttempts + 1;
  const totalFailures = s.totalFailures + 1;
  if (failedAttempts >= ATTEMPTS_PER_ROUND) {
    const step = LOCKOUT_STEPS_SECONDS[Math.min(s.lockouts, LOCKOUT_STEPS_SECONDS.length - 1)];
    return { failedAttempts, totalFailures, lockouts: s.lockouts + 1, lockoutUntil: now + step * 1000 };
  }
  return { ...s, failedAttempts, totalFailures };
}

export function statusOf(state: LockoutState, now: number): LockoutStatus {
  const s = settle(state, now);
  const remainingMs = s.lockoutUntil === null ? 0 : s.lockoutUntil - now;
  return {
    lockedOut: remainingMs > 0,
    remainingSeconds: Math.ceil(Math.max(0, remainingMs) / 1000),
    attemptsLeft: Math.max(0, ATTEMPTS_PER_ROUND - s.failedAttempts),
    totalFailures: s.totalFailures,
  };
}

/** "1 minute", "15 minutes", "1 hour" for the next lockout after this one. */
export function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.ceil(seconds / 3600);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  if (seconds >= 60) {
    const m = Math.ceil(seconds / 60);
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

// ---- Persisted state ----

let state: LockoutState = INITIAL;
let hydrated = false;

function parse(raw: string | null): LockoutState {
  if (!raw) return INITIAL;
  try {
    const p = JSON.parse(raw) as Partial<LockoutState>;
    if (typeof p.failedAttempts !== 'number') return INITIAL;
    return {
      failedAttempts: p.failedAttempts,
      lockoutUntil: typeof p.lockoutUntil === 'number' ? p.lockoutUntil : null,
      lockouts: typeof p.lockouts === 'number' ? p.lockouts : 0,
      totalFailures: typeof p.totalFailures === 'number' ? p.totalFailures : p.failedAttempts,
    };
  } catch {
    return INITIAL;
  }
}

export async function initLockout(): Promise<void> {
  if (hydrated) return;
  state = parse(await SecureStore.getItemAsync(STORAGE_KEY).catch(() => null));
  hydrated = true;
}

async function persist(): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

export function getLockoutStatus(): LockoutStatus {
  return statusOf(state, Date.now());
}

/** Record a wrong PIN. Persisted before returning, so it survives a force-quit. */
export async function recordFailure(): Promise<LockoutStatus> {
  await initLockout();
  state = applyFailure(state, Date.now());
  await persist();
  return getLockoutStatus();
}

export async function recordSuccess(): Promise<void> {
  state = INITIAL;
  await persist();
}

export async function resetLockoutState(): Promise<void> {
  state = INITIAL;
  await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
}

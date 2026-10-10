import { applyFailure, formatDuration, statusOf, type LockoutState } from '../lockout';

const fresh: LockoutState = { failedAttempts: 0, lockoutUntil: null, lockouts: 0, totalFailures: 0 };

function fail(state: LockoutState, times: number, now: number): LockoutState {
  let s = state;
  for (let i = 0; i < times; i++) s = applyFailure(s, now);
  return s;
}

describe('lockout schedule', () => {
  it('allows four wrong attempts, then locks for a minute', () => {
    const t = 1_000_000;
    let s = fail(fresh, 4, t);
    expect(statusOf(s, t)).toMatchObject({ lockedOut: false, attemptsLeft: 1 });
    s = applyFailure(s, t);
    expect(statusOf(s, t)).toMatchObject({ lockedOut: true, remainingSeconds: 60 });
  });

  it('escalates 1 min, 5 min, 15 min, 1 h and then stays at 1 h', () => {
    let t = 0;
    let s = fresh;
    const durations: number[] = [];
    for (let round = 0; round < 6; round++) {
      s = fail(s, 5, t);
      const status = statusOf(s, t);
      durations.push(status.remainingSeconds);
      t += status.remainingSeconds * 1000; // wait it out
    }
    expect(durations).toEqual([60, 300, 900, 3600, 3600, 3600]);
    expect(s.totalFailures).toBe(30);
  });

  it('ignores attempts made while locked out', () => {
    const t = 5_000;
    const locked = fail(fresh, 5, t);
    const after = fail(locked, 3, t + 1000);
    expect(after).toEqual(locked);
  });

  it('gives a new round of five attempts after the lockout expires', () => {
    const locked = fail(fresh, 5, 0);
    expect(statusOf(locked, 60_000)).toMatchObject({ lockedOut: false, attemptsLeft: 5 });
  });

  it('counts remaining seconds up, never down to zero early', () => {
    const locked = fail(fresh, 5, 0);
    expect(statusOf(locked, 59_001).remainingSeconds).toBe(1);
  });
});

describe('formatDuration', () => {
  it('uses the largest whole unit', () => {
    expect(formatDuration(1)).toBe('1 second');
    expect(formatDuration(45)).toBe('45 seconds');
    expect(formatDuration(60)).toBe('1 minute');
    expect(formatDuration(299)).toBe('5 minutes');
    expect(formatDuration(3600)).toBe('1 hour');
  });
});

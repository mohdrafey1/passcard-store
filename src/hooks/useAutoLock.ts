import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';

/**
 * Some in-app actions intentionally send the app to the background (the system
 * file picker, the share sheet). Without this guard, a user whose auto-lock is
 * set to "immediate" would be locked out the moment they return from one of
 * those flows. Wrap such calls in `runWithoutAutoLock` to suppress the next
 * lock-on-resume.
 */
let suppressCount = 0;

export function isAutoLockSuppressed(): boolean {
  return suppressCount > 0;
}

export async function runWithoutAutoLock<T>(fn: () => Promise<T>): Promise<T> {
  suppressCount += 1;
  try {
    return await fn();
  } finally {
    // Release slightly later than the promise resolves: the AppState "active"
    // event can fire a beat after the picker/share returns, and it must still
    // see the suppression.
    setTimeout(() => {
      suppressCount = Math.max(0, suppressCount - 1);
    }, 1000);
  }
}

/**
 * Auto-lock the app when backgrounded for the configured duration.
 */
export function useAutoLock() {
  const autoLockDuration = useSettingsStore((s) => s.autoLockDuration);
  const isAuthenticated = useSettingsStore((s) => s.isAuthenticated);
  const setAuthenticated = useSettingsStore((s) => s.setAuthenticated);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active' && backgroundedAt.current !== null) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;

        // Skip locking if the backgrounding was caused by an in-app flow that
        // uses the file picker or share sheet.
        if (isAutoLockSuppressed()) return;

        // Lock immediately (0) or once the elapsed time exceeds the duration.
        if (autoLockDuration === 0 || elapsed >= autoLockDuration * 1000) {
          setAuthenticated(false);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, autoLockDuration, setAuthenticated]);
}

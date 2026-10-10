import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';
import { lockVault } from '@/features/session/session';
import { isAutoLockSuppressed } from '@/utils/auto-lock-guard';

/**
 * Lock when the app is backgrounded: immediately for "Immediately" (so the key
 * isn't kept in memory while away), otherwise once the configured time has
 * passed by the time the user comes back.
 */
export function useAutoLock() {
  const autoLockDuration = useSettingsStore((s) => s.autoLockDuration);
  const isAuthenticated = useSettingsStore((s) => s.isAuthenticated);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        if (isAutoLockSuppressed()) return;
        if (autoLockDuration === 0) {
          lockVault();
          return;
        }
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active' && backgroundedAt.current !== null) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (isAutoLockSuppressed()) return;
        if (elapsed >= autoLockDuration * 1000) lockVault();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, autoLockDuration]);
}

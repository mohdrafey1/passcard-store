import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';

/**
 * Auto-lock the app when backgrounded for configured duration
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

        // If auto-lock is immediate (0) or elapsed time exceeds duration
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

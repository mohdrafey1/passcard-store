import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import PinPad from '@/components/PinPad';
import { getPinLength } from '@/security/pin';
import {
  unlockWithPin,
  unlockWithBiometricKey,
  enableBiometricKey,
} from '@/security/key-manager';
import { authenticateWithBiometrics, isBiometricAvailable } from '@/security/biometrics';
import { isLockedOut, recordFailedAttempt, resetLockout, getLockoutRemainingSeconds, getRemainingAttempts, initLockout } from '@/security/lockout';
import { useSettingsStore } from '@/features/settings/store';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function UnlockScreen() {
  const [error, setError] = useState('');
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [canBiometric, setCanBiometric] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const biometricsEnabled = useSettingsStore((s) => s.biometricsEnabled);
  const setAuthenticated = useSettingsStore((s) => s.setAuthenticated);

  useEffect(() => {
    async function init() {
      await initLockout();
      if (isLockedOut()) {
        setLockedOut(true);
        setLockoutSeconds(getLockoutRemainingSeconds());
      }
      const len = await getPinLength();
      setPinLength(len);

      if (biometricsEnabled) {
        const available = await isBiometricAvailable();
        setCanBiometric(available);
        if (available && !isLockedOut()) {
          handleBiometric();
        }
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricsEnabled]);

  // Lockout timer
  useEffect(() => {
    if (!lockedOut) return;
    const interval = setInterval(() => {
      const remaining = getLockoutRemainingSeconds();
      if (remaining <= 0) {
        setLockedOut(false);
        setLockoutSeconds(0);
        setError('');
      } else {
        setLockoutSeconds(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedOut]);

  const registerLockout = useCallback(() => {
    setLockedOut(true);
    setLockoutSeconds(getLockoutRemainingSeconds());
    setError('Too many failed attempts. Try again in 1 minute.');
  }, []);

  const handleBiometric = useCallback(async () => {
    if (isLockedOut()) {
      setLockedOut(true);
      setLockoutSeconds(getLockoutRemainingSeconds());
      return;
    }
    const result = await authenticateWithBiometrics();
    if (result.success) {
      const opened = await unlockWithBiometricKey();
      if (opened) {
        resetLockout();
        setAuthenticated(true);
        router.replace('/(tabs)');
        return;
      }
      // Biometrics passed but no key is provisioned for it — fall back to PIN.
      setError('Please unlock with your PIN.');
    } else if (result.error === 'authentication_failed' || result.error === 'lockout') {
      // A genuine biometric mismatch counts toward the lockout too.
      if (recordFailedAttempt()) registerLockout();
    }
  }, [setAuthenticated, registerLockout]);

  const handlePinComplete = useCallback(async (pin: string) => {
    if (isLockedOut()) {
      setLockedOut(true);
      setLockoutSeconds(getLockoutRemainingSeconds());
      return;
    }

    setVerifying(true);
    let valid = false;
    try {
      valid = await unlockWithPin(pin);
    } finally {
      setVerifying(false);
    }
    if (valid) {
      resetLockout();
      // Re-provision the biometric key slot for users who had biometrics on
      // before this build (migration) so future biometric unlocks work.
      if (biometricsEnabled) {
        await enableBiometricKey().catch(() => {});
      }
      setAuthenticated(true);
      router.replace('/(tabs)');
    } else {
      const locked = recordFailedAttempt();
      if (locked) {
        registerLockout();
      } else {
        const remaining = getRemainingAttempts();
        setError(`Wrong PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      }
    }
  }, [setAuthenticated, biometricsEnabled, registerLockout]);

  return (
    <SafeAreaView style={styles.container}>
      {lockedOut ? (
        <View style={styles.lockoutContainer}>
          <Ionicons name="lock-closed" size={64} color={Colors.danger} />
          <Text style={styles.lockoutTitle}>App Locked</Text>
          <Text style={styles.lockoutSubtitle}>
            Too many failed attempts.{'\n'}
            Try again in {lockoutSeconds} second{lockoutSeconds !== 1 ? 's' : ''}.
          </Text>
        </View>
      ) : (
        <PinPad
          pinLength={pinLength}
          onComplete={handlePinComplete}
          onBiometric={canBiometric ? handleBiometric : undefined}
          showBiometric={canBiometric}
          title="Unlock Vault"
          subtitle="Enter your PIN to access your data"
          error={error}
        />
      )}
      {verifying && (
        <View style={styles.verifyingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.verifyingText}>Unlocking…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  lockoutContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246, 242, 235, 0.7)',
    gap: Spacing.md,
  },
  verifyingText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  lockoutTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.danger,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  lockoutSubtitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});

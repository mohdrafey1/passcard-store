import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import PinPad from '@/components/PinPad';
import { verifyStoredPin, getPinLength } from '@/security/pin';
import { authenticateWithBiometrics, isBiometricAvailable } from '@/security/biometrics';
import { isLockedOut, recordFailedAttempt, resetLockout, getLockoutRemainingSeconds, getRemainingAttempts } from '@/security/lockout';
import { useSettingsStore } from '@/features/settings/store';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function UnlockScreen() {
  const [error, setError] = useState('');
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [canBiometric, setCanBiometric] = useState(false);
  const biometricsEnabled = useSettingsStore((s) => s.biometricsEnabled);
  const setAuthenticated = useSettingsStore((s) => s.setAuthenticated);

  useEffect(() => {
    async function init() {
      const len = await getPinLength();
      setPinLength(len);

      if (biometricsEnabled) {
        const available = await isBiometricAvailable();
        setCanBiometric(available);
        if (available) {
          handleBiometric();
        }
      }
    }
    init();
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

  const handleBiometric = useCallback(async () => {
    const success = await authenticateWithBiometrics();
    if (success) {
      resetLockout();
      setAuthenticated(true);
      router.replace('/(tabs)');
    }
  }, [setAuthenticated]);

  const handlePinComplete = useCallback(async (pin: string) => {
    if (isLockedOut()) {
      setLockedOut(true);
      setLockoutSeconds(getLockoutRemainingSeconds());
      return;
    }

    const valid = await verifyStoredPin(pin);
    if (valid) {
      resetLockout();
      setAuthenticated(true);
      router.replace('/(tabs)');
    } else {
      const locked = recordFailedAttempt();
      if (locked) {
        setLockedOut(true);
        setLockoutSeconds(getLockoutRemainingSeconds());
        setError('Too many failed attempts. Try again in 1 minute.');
      } else {
        const remaining = getRemainingAttempts();
        setError(`Wrong PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      }
    }
  }, [setAuthenticated]);

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

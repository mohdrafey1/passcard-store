import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PinPad from '@/components/PinPad';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useSettingsStore } from '@/features/settings/store';
import { checkSecretWithLockout, completeUnlock, currentLockoutMessage } from '@/features/session/session';
import {
  dismissBiometricReoffer,
  enableBiometricUnlock,
  shouldReofferBiometrics,
  unlockWithBiometrics,
  unlockWithSecret,
} from '@/security/key-manager';
import { getLockoutStatus, initLockout } from '@/security/lockout';

export default function UnlockScreen() {
  const method = useSettingsStore((s) => s.unlockMethod);
  const pinLength = useSettingsStore((s) => s.pinLength) ?? 6;
  const biometricsEnabled = useSettingsStore((s) => s.biometricsEnabled);
  const biometricsAvailable = useSettingsStore((s) => s.biometricsAvailable);
  const refreshSecurity = useSettingsStore((s) => s.refreshSecurity);
  const [error, setError] = useState('');
  const [lockedOut, setLockedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const promptedRef = useRef(false);
  const noun = method === 'pin' ? 'PIN' : 'passphrase';

  const refreshLockout = useCallback(() => {
    const message = currentLockoutMessage();
    setLockedOut(message !== null);
    if (message) setError(message);
    return message !== null;
  }, []);

  const finish = useCallback(async () => {
    await completeUnlock();
    router.replace('/(tabs)');
  }, []);

  /** Users upgrading from v1.1 had fingerprint unlock on; offer it again. */
  const maybeReofferBiometrics = useCallback(async () => {
    if (!(await shouldReofferBiometrics())) return;
    await dismissBiometricReoffer();
    if (!biometricsAvailable) return;
    await new Promise<void>((resolve) =>
      Alert.alert(
        'Keep fingerprint unlock?',
        'Fingerprint unlock now keeps your vault key in Android’s secure hardware. Confirm your fingerprint once to keep using it.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Keep it',
            onPress: async () => {
              await enableBiometricUnlock().catch(() => {});
              await refreshSecurity();
              resolve();
            },
          },
        ],
        { cancelable: false },
      ),
    );
  }, [biometricsAvailable, refreshSecurity]);

  const handleBiometric = useCallback(async () => {
    if (refreshLockout() || busy) return;
    setBusy(true);
    try {
      const result = await unlockWithBiometrics();
      if (result === 'ok') {
        await finish();
        return;
      }
      if (result === 'invalidated') {
        await refreshSecurity();
        setError(`Fingerprints changed on this phone. Unlock with your ${noun}, then turn fingerprint unlock on again.`);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, finish, noun, refreshLockout, refreshSecurity]);

  useEffect(() => {
    initLockout().then(() => {
      const locked = refreshLockout();
      if (!locked && biometricsEnabled && !promptedRef.current) {
        promptedRef.current = true;
        handleBiometric();
      }
    });
    // Run once on mount; later prompts come from the fingerprint key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count down an active lockout.
  useEffect(() => {
    if (!lockedOut) return;
    const timer = setInterval(() => {
      if (!getLockoutStatus().lockedOut) {
        setLockedOut(false);
        setError('');
      } else {
        refreshLockout();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedOut, refreshLockout]);

  const submit = useCallback(
    async (secret: string) => {
      if (!secret || busy) return;
      setBusy(true);
      try {
        const result = await checkSecretWithLockout(() => unlockWithSecret(secret), noun);
        if (result.ok) {
          await maybeReofferBiometrics();
          await finish();
          return;
        }
        if (result.erased) {
          router.replace('/');
          return;
        }
        setError(result.message);
        setLockedOut(result.lockedOut);
      } catch (e) {
        // Error messages from the crypto/storage layer never contain secrets.
        console.warn('Unlock failed:', e instanceof Error ? e.message : String(e));
        setError('Something went wrong reading the vault. Try again.');
      } finally {
        setPassphrase('');
        setBusy(false);
      }
    },
    [busy, finish, maybeReofferBiometrics, noun],
  );

  return (
    <SafeAreaView style={styles.container}>
      {lockedOut ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={56} color={Colors.danger} />
          <Text style={styles.lockTitle}>Locked for now</Text>
          <Text style={styles.lockText} accessibilityLiveRegion="polite">
            {error}
          </Text>
        </View>
      ) : method === 'pin' ? (
        <PinPad
          pinLength={pinLength}
          onComplete={submit}
          onBiometric={biometricsEnabled ? handleBiometric : undefined}
          showBiometric={biometricsEnabled}
          title="Welcome back"
          subtitle={`Enter your ${pinLength}-digit PIN`}
          error={error}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.lockTitle}>Welcome back</Text>
          <TextInput
            style={styles.input}
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Passphrase"
            placeholder="Passphrase"
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={() => submit(passphrase)}
            returnKeyType="go"
          />
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => submit(passphrase)} accessibilityRole="button">
            <Text style={styles.buttonText}>Unlock</Text>
          </TouchableOpacity>
          {biometricsEnabled && (
            <TouchableOpacity onPress={handleBiometric} style={styles.link} accessibilityRole="button">
              <Text style={styles.linkText}>Use fingerprint</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {busy && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.overlayText}>Unlocking…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  lockTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  lockText: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  input: {
    alignSelf: 'stretch',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  error: { minHeight: 20, color: Colors.danger, fontSize: FontSize.sm, textAlign: 'center' },
  button: {
    alignSelf: 'stretch',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: Colors.white, fontSize: FontSize.base, fontWeight: '700' },
  link: { padding: Spacing.md },
  linkText: { color: Colors.textSecondary, fontSize: FontSize.base, fontWeight: '600' },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(246, 242, 235, 0.7)',
  },
  overlayText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textSecondary },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Layout';
import { PinPad } from '@/components/ui/PinPad';
import { Sheet } from '@/components/ui/Sheet';
import { checkSecretWithLockout, completeUnlock, currentLockoutMessage, eraseVault } from '@/features/session/session';
import { useSettingsStore } from '@/features/settings/store';
import {
  dismissBiometricReoffer,
  enableBiometricUnlock,
  shouldReofferBiometrics,
  unlockWithBiometrics,
  unlockWithSecret,
} from '@/security/key-manager';
import { getLockoutStatus, initLockout } from '@/security/lockout';
import { space, useTheme } from '@/theme';

export default function UnlockScreen() {
  const c = useTheme();
  const method = useSettingsStore((s) => s.unlockMethod);
  const pinLength = useSettingsStore((s) => s.pinLength) ?? 6;
  const biometricsEnabled = useSettingsStore((s) => s.biometricsEnabled);
  const biometricsAvailable = useSettingsStore((s) => s.biometricsAvailable);
  const refreshSecurity = useSettingsStore((s) => s.refreshSecurity);
  const [error, setError] = useState<string | undefined>();
  const [lockedOut, setLockedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const prompted = useRef(false);
  const noun = method === 'pin' ? 'PIN' : 'passphrase';

  const refreshLockout = useCallback(() => {
    const message = currentLockoutMessage();
    setLockedOut(message !== null);
    if (message) setError(message);
    return message !== null;
  }, []);

  /** Users upgrading from v1.1 had fingerprint unlock on; offer it again once. */
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
        await completeUnlock();
        return;
      }
      if (result === 'invalidated') {
        await refreshSecurity();
        setError(`Fingerprints on this phone changed. Unlock with your ${noun}, then turn fingerprint unlock on again.`);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, noun, refreshLockout, refreshSecurity]);

  useEffect(() => {
    initLockout().then(() => {
      if (!refreshLockout() && biometricsEnabled && !prompted.current) {
        prompted.current = true;
        handleBiometric();
      }
    });
    // Once on mount; later prompts come from the fingerprint key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lockedOut) return;
    const timer = setInterval(() => {
      if (!getLockoutStatus().lockedOut) {
        setLockedOut(false);
        setError(undefined);
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
          await completeUnlock();
          return;
        }
        if (result.erased) return; // The router moves to onboarding.
        setError(result.message);
        setLockedOut(result.lockedOut);
      } catch (e) {
        console.warn('Unlock failed:', e instanceof Error ? e.message : String(e));
        setError('Something went wrong reading the vault. Try again.');
      } finally {
        setPassphrase('');
        setBusy(false);
      }
    },
    [busy, maybeReofferBiometrics, noun],
  );

  const confirmErase = () =>
    Alert.alert(
      'Erase this vault?',
      'Everything in it is deleted from this phone. You can then set up again and restore a backup, if you have one.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: () => void eraseVault() },
      ],
    );

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.brand}>
        <Image source={require('@/assets/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors accessible={false} />
      </View>

      {lockedOut ? (
        <View style={styles.center}>
          <View style={[styles.lockIcon, { backgroundColor: c.dangerSoft }]}>
            <Icon name="lock" size={30} color={c.danger} />
          </View>
          <AppText variant="title" align="center" accessibilityRole="header">
            Locked for now
          </AppText>
          <AppText variant="body" tone="ink2" align="center" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        </View>
      ) : method === 'pin' ? (
        <View style={styles.pin}>
          <PinPad
            length={pinLength}
            onComplete={submit}
            onBiometric={biometricsEnabled ? handleBiometric : undefined}
            title="Welcome back"
            subtitle={`Enter your ${pinLength}-digit PIN`}
            error={error}
            disabled={busy}
          />
        </View>
      ) : (
        <KeyboardAvoidingView behavior="height" style={styles.center}>
          <AppText variant="title" align="center" accessibilityRole="header">
            Welcome back
          </AppText>
          <View style={{ alignSelf: 'stretch', gap: space.md }}>
            <Field
              label="Passphrase"
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => submit(passphrase)}
              returnKeyType="go"
              error={error}
            />
            <Button label="Unlock" onPress={() => submit(passphrase)} loading={busy} />
            {biometricsEnabled ? (
              <Button label="Use fingerprint" variant="secondary" icon="fingerprint" onPress={handleBiometric} />
            ) : null}
          </View>
        </KeyboardAvoidingView>
      )}

      <View style={styles.footer}>
        {busy && method === 'pin' ? (
          <ActivityIndicator color={c.brass} accessibilityLabel="Unlocking" />
        ) : (
          <Button label={`Forgot ${noun}?`} variant="quiet" onPress={() => setForgotOpen(true)} />
        )}
      </View>

      <Sheet
        visible={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title={`Forgot your ${noun}?`}
        subtitle={`There's no way to recover it: it's the only key to your data. If you have a backup, erase this vault and restore it.`}
        options={[{ label: 'Erase vault and start over', icon: 'trash-2', destructive: true, onPress: confirmErase }]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', paddingTop: space.xxl },
  logo: { width: 72, height: 72, borderRadius: 18 },
  pin: { flex: 1, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.xxl },
  lockIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', minHeight: 64, justifyContent: 'center', paddingBottom: space.md },
});

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { StrengthMeter } from '@/components/ui/Controls';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Layout';
import { PinPad } from '@/components/ui/PinPad';
import { applyBackup, backupCategories } from '@/features/import-export/backup-handler';
import { useOnboarding } from '@/features/onboarding/state';
import { completeUnlock } from '@/features/session/session';
import { useSettingsStore } from '@/features/settings/store';
import { createVault, enableBiometricUnlock } from '@/security/key-manager';
import { weakPassphraseReason, weakPinReason } from '@/security/pin-rules';
import { space, useTheme } from '@/theme';
import type { AutoLockDuration, ClipboardClearDuration } from '@/types/settings';
import { AUTO_LOCK_OPTIONS, CLIPBOARD_CLEAR_OPTIONS } from '@/types/settings';
import { measureStrength } from '@/utils/strength';

export default function CreateSecretScreen() {
  const c = useTheme();
  const { method, pinLength, fingerprint, pendingRestore, reset } = useOnboarding();
  const settings = useSettingsStore();
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [phrase2, setPhrase2] = useState('');
  const strength = useMemo(() => measureStrength(phrase), [phrase]);

  const finish = async (secret: string) => {
    setBusy(true);
    try {
      await createVault(secret, method, method === 'pin' ? pinLength : null);
      if (fingerprint && settings.biometricsAvailable) {
        // Shows the system prompt; if dismissed, it can be turned on later in Settings.
        await enableBiometricUnlock().catch(() => {});
      }
      if (pendingRestore) {
        await applyBackup(pendingRestore, 'replace');
        const categories = backupCategories(pendingRestore);
        if (categories) await settings.update('categories', categories);
        const s = pendingRestore.settings;
        if (s && AUTO_LOCK_OPTIONS.some((o) => o.value === s.autoLockDuration)) {
          await settings.update('autoLockDuration', s.autoLockDuration as AutoLockDuration);
        }
        if (s && CLIPBOARD_CLEAR_OPTIONS.some((o) => o.value === s.clipboardClearDuration)) {
          await settings.update('clipboardClearDuration', s.clipboardClearDuration as ClipboardClearDuration);
        }
      }
      // Unlock first, then mark the vault as existing: the router then moves
      // straight from onboarding into the vault.
      await completeUnlock();
      await settings.refreshSecurity();
      reset();
    } catch (e) {
      setBusy(false);
      setStep('create');
      setFirst('');
      setError(e instanceof Error ? e.message : 'Could not create the vault. Try again.');
    }
  };

  const onPin = (pin: string) => {
    if (step === 'create') {
      const weak = weakPinReason(pin);
      if (weak) {
        setError(`${weak} Choose another PIN.`);
        return;
      }
      setFirst(pin);
      setError(undefined);
      setStep('confirm');
      return;
    }
    if (pin !== first) {
      setStep('create');
      setFirst('');
      setError("Those PINs didn't match. Start again.");
      return;
    }
    finish(pin);
  };

  const phraseProblem =
    weakPassphraseReason(phrase) ?? (phrase && strength.score < 2 ? strength.hint ?? 'Too easy to guess. Add more words.' : null);

  const onPhrase = () => {
    if (phraseProblem) {
      setError(phraseProblem);
      return;
    }
    if (phrase !== phrase2) {
      setError("Those passphrases don't match.");
      return;
    }
    setError(undefined);
    finish(phrase);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} disabled={busy} />
        <View style={styles.progress} accessible accessibilityLabel="Step 2 of 2">
          <View style={[styles.step, { backgroundColor: c.brass }]} />
          <View style={[styles.step, { backgroundColor: c.brass }]} />
        </View>
        <AppText variant="caption" tone="muted">
          2 of 2
        </AppText>
      </View>

      {method === 'pin' ? (
        <View style={styles.pin}>
          <PinPad
            length={pinLength}
            resetKey={step}
            onComplete={onPin}
            title={step === 'create' ? `Choose a ${pinLength}-digit PIN` : 'Enter it again'}
            subtitle={step === 'create' ? 'Avoid repeats, sequences and years.' : 'To make sure it’s right.'}
            error={error}
            disabled={busy}
          />
        </View>
      ) : (
        <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <AppText variant="title" accessibilityRole="header">
              Choose a passphrase
            </AppText>
            <AppText variant="body" tone="ink2">
              Four or more unrelated words work well, like “lantern copper orbit tidal”.
            </AppText>
            <Field
              label="Passphrase"
              value={phrase}
              onChangeText={(t) => {
                setPhrase(t);
                setError(undefined);
              }}
              secureTextEntry
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            {phrase ? <StrengthMeter score={strength.score} label={strength.label} detail={strength.hint ?? undefined} /> : null}
            <Field
              label="Type it again"
              value={phrase2}
              onChangeText={(t) => {
                setPhrase2(t);
                setError(undefined);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              error={error}
              onSubmitEditing={onPhrase}
              returnKeyType="done"
            />
            <Button label="Create vault" onPress={onPhrase} loading={busy} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {busy ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.scrim }]} accessibilityViewIsModal>
          <ActivityIndicator size="large" color={c.brass} />
          <AppText variant="bodyStrong" style={{ color: '#F3EFE7' }} accessibilityLiveRegion="polite">
            {pendingRestore ? 'Setting up and restoring…' : 'Setting up your vault…'}
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, paddingTop: space.sm },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  step: { flex: 1, height: 4, borderRadius: 2 },
  pin: { flex: 1, justifyContent: 'center', paddingBottom: space.xxl },
  form: { padding: space.xl, gap: space.lg },
  overlay: { alignItems: 'center', justifyContent: 'center', gap: space.md },
});

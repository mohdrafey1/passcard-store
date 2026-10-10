import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { StrengthMeter } from '@/components/ui/Controls';
import { Field } from '@/components/ui/Field';
import { PinPad } from '@/components/ui/PinPad';
import { showToast } from '@/components/ui/Toast';
import { ReauthModal } from '@/components/ReauthModal';
import { useSettingsStore } from '@/features/settings/store';
import { changeSecret, type UnlockMethod } from '@/security/key-manager';
import { weakPassphraseReason, weakPinReason } from '@/security/pin-rules';
import { radius, space, useTheme } from '@/theme';
import { measureStrength } from '@/utils/strength';

type Choice = { method: UnlockMethod; pinLength: 4 | 6 | null; title: string; body: string };

const CHOICES: Choice[] = [
  { method: 'pin', pinLength: 6, title: '6-digit PIN', body: 'Quick to type. Pairs well with fingerprint unlock.' },
  { method: 'passphrase', pinLength: null, title: 'Passphrase', body: 'Letters, numbers or words. The strongest choice.' },
  { method: 'pin', pinLength: 4, title: '4-digit PIN', body: 'Fastest, and the easiest to guess.' },
];

export default function UnlockMethodScreen() {
  const c = useTheme();
  const currentMethod = useSettingsStore((s) => s.unlockMethod);
  const currentPinLength = useSettingsStore((s) => s.pinLength);
  const current = { method: currentMethod, pinLength: currentPinLength };
  const refreshSecurity = useSettingsStore((s) => s.refreshSecurity);
  const [verified, setVerified] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [phrase2, setPhrase2] = useState('');
  const strength = useMemo(() => measureStrength(phrase), [phrase]);

  const save = async (secret: string) => {
    if (!choice) return;
    setBusy(true);
    try {
      await changeSecret(secret, choice.method, choice.pinLength);
      await refreshSecurity();
      showToast(`Now unlocking with your ${choice.method === 'pin' ? `${choice.pinLength}-digit PIN` : 'passphrase'}`);
      router.back();
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Nothing changed. Try again.');
    }
  };

  const onPin = (pin: string) => {
    if (step === 'create') {
      const weak = weakPinReason(pin);
      if (weak) return setError(`${weak} Choose another PIN.`);
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
    void save(pin);
  };

  const onPhrase = () => {
    const problem = weakPassphraseReason(phrase) ?? (strength.score < 2 ? (strength.hint ?? 'Too easy to guess. Add more words.') : null);
    if (problem) return setError(problem);
    if (phrase !== phrase2) return setError("Those passphrases don't match.");
    void save(phrase);
  };

  if (!verified) {
    return <ReauthModal visible reason="change how you unlock" onVerified={() => setVerified(true)} onClose={() => router.back()} />;
  }

  if (!choice) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="body" tone="ink2">
          Pick a new way to unlock. Your vault stays as it is; only the key that opens it changes.
        </AppText>
        <View accessibilityRole="radiogroup" style={{ gap: space.sm + 2 }}>
          {CHOICES.map((o) => {
            const isCurrent = o.method === current.method && o.pinLength === current.pinLength;
            return (
              <Pressable
                key={o.title}
                onPress={() => {
                  setChoice(o);
                  setError(undefined);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${o.title}. ${o.body}${isCurrent ? ' Current' : ''}`}
                style={[styles.option, { backgroundColor: c.surface, borderColor: c.line }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">
                    {o.title}
                    {isCurrent ? (
                      <AppText variant="caption" tone="muted">
                        {'  '}current
                      </AppText>
                    ) : null}
                  </AppText>
                  <AppText variant="caption" tone="ink2" style={{ fontSize: 14, fontWeight: '500' }}>
                    {o.body}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  if (choice.method === 'pin') {
    return (
      <View style={styles.pin}>
        <PinPad
          length={choice.pinLength ?? 6}
          resetKey={step}
          onComplete={onPin}
          title={step === 'create' ? `New ${choice.pinLength}-digit PIN` : 'Enter it again'}
          subtitle={step === 'create' ? 'Avoid repeats, sequences and years.' : 'To make sure it’s right.'}
          error={error}
          disabled={busy}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="New passphrase"
          value={phrase}
          onChangeText={setPhrase}
          secureTextEntry
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
        {phrase ? <StrengthMeter score={strength.score} label={strength.label} detail={strength.hint ?? undefined} /> : null}
        <Field
          label="Type it again"
          value={phrase2}
          onChangeText={setPhrase2}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
          onSubmitEditing={onPhrase}
        />
        <Button label="Use this passphrase" onPress={onPhrase} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg },
  option: { borderWidth: 1, borderRadius: radius.row, padding: space.lg, flexDirection: 'row', alignItems: 'center' },
  pin: { flex: 1, justifyContent: 'center', paddingBottom: space.xxl },
});

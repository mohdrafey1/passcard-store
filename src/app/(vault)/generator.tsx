import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Segmented, StrengthMeter, Toggle } from '@/components/ui/Controls';
import { IconButton } from '@/components/ui/IconButton';
import { useGeneratorBridge, useCopySecret } from '@/features/vault/actions';
import { MONO, radius, space, useTheme } from '@/theme';
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  generatePassphrase,
  generatePassword,
  generatePin,
  PASSPHRASE_WORDS_RANGE,
  passphraseEntropyBits,
  PASSWORD_LENGTH_RANGE,
  passwordEntropyBits,
  PIN_LENGTH_RANGE,
  scoreFromEntropy,
  STRENGTH_LABELS,
  type PassphraseOptions,
  type PasswordOptions,
} from '@/utils/password-generator';

type Mode = 'random' | 'passphrase' | 'pin';

function Stepper({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; unit: string }) {
  const c = useTheme();
  return (
    <View style={[styles.optionRow, { borderBottomColor: c.divider }]}>
      <AppText variant="body" style={{ flex: 1, fontWeight: '600' }}>
        {label}
      </AppText>
      <View
        style={styles.stepper}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: `${value} ${unit}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
      >
        <IconButton icon="minus" label={`Fewer ${unit}`} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} />
        <AppText style={{ fontFamily: MONO, fontWeight: '600', fontSize: 17, minWidth: 34, textAlign: 'center', color: c.ink }}>{value}</AppText>
        <IconButton icon="plus" label={`More ${unit}`} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} />
      </View>
    </View>
  );
}

function Switch({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useTheme();
  return (
    <View style={[styles.optionRow, { borderBottomColor: c.divider }]}>
      <AppText variant="body" style={{ flex: 1, fontWeight: '600' }}>
        {label}{' '}
        {hint ? (
          <AppText variant="body" tone="muted" style={{ fontWeight: '500' }}>
            {hint}
          </AppText>
        ) : null}
      </AppText>
      <Toggle value={value} onValueChange={onChange} label={label} />
    </View>
  );
}

export default function GeneratorScreen() {
  const c = useTheme();
  const { target } = useLocalSearchParams<{ target?: string }>();
  const toForm = target === 'form';
  const deliver = useGeneratorBridge((s) => s.deliver);
  const copy = useCopySecret();
  const [mode, setMode] = useState<Mode>('random');
  const [pw, setPw] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  const [phrase, setPhrase] = useState<PassphraseOptions>(DEFAULT_PASSPHRASE_OPTIONS);
  const [pinLength, setPinLength] = useState(6);
  const [nonce, setNonce] = useState(0);

  const value = useMemo(() => {
    void nonce; // a new value whenever "Generate again" is pressed
    if (mode === 'random') return generatePassword(pw);
    if (mode === 'passphrase') return generatePassphrase(phrase);
    return generatePin(pinLength);
  }, [mode, pw, phrase, pinLength, nonce]);

  const bits = mode === 'random' ? passwordEntropyBits(pw) : mode === 'passphrase' ? passphraseEntropyBits(phrase) : pinLength * Math.log2(10);
  const score = scoreFromEntropy(bits);
  const noun = mode === 'passphrase' ? 'passphrase' : mode === 'pin' ? 'PIN' : 'password';
  const detail =
    mode === 'random' ? `${pw.length} characters` : mode === 'passphrase' ? `${phrase.words} words` : `${pinLength} digits`;

  const finish = useCallback(() => {
    if (toForm) deliver(value);
    else void copy(value, mode === 'pin' ? 'PIN' : 'Password');
    router.back();
  }, [copy, deliver, mode, toForm, value]);

  const setPwOption = <K extends keyof PasswordOptions>(k: K, v: PasswordOptions[K]) => {
    const next = { ...pw, [k]: v };
    // Keep at least one character set on.
    if (!next.lowercase && !next.uppercase && !next.numbers && !next.symbols) return;
    setPw(next);
  };

  return (
    <View style={[styles.sheet, { backgroundColor: c.surface }]}>
      <View style={styles.titleRow}>
        <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
          Generate
        </AppText>
        <IconButton icon="x" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Segmented
          label="Kind"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'random', label: 'Random' },
            { value: 'passphrase', label: 'Passphrase' },
            { value: 'pin', label: 'PIN' },
          ]}
        />

        <View style={[styles.output, { backgroundColor: c.raised }]}>
          <Text
            style={styles.outputText}
            accessibilityLabel={`Generated ${noun}: ${value.split('').join(' ')}`}
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={1.6}
          >
            {value.split('').map((ch, i) => (
              <Text key={i} style={{ color: /[0-9]/.test(ch) ? c.brassText : /[A-Za-z]/.test(ch) ? c.ink : c.info }}>
                {ch}
              </Text>
            ))}
          </Text>
          <View>
            <IconButton icon="refresh-cw" label="Generate again" onPress={() => setNonce((n) => n + 1)} />
            <IconButton icon="copy" tone="brass" label={`Copy ${noun}`} onPress={() => copy(value, mode === 'pin' ? 'PIN' : 'Password')} />
          </View>
        </View>
        <StrengthMeter score={score} label={mode === 'pin' && score < 2 ? 'Only for PIN fields' : STRENGTH_LABELS[score]} detail={detail} />

        <View>
          {mode === 'random' ? (
            <>
              <Stepper
                label="Length"
                unit="characters"
                value={pw.length}
                min={PASSWORD_LENGTH_RANGE.min}
                max={PASSWORD_LENGTH_RANGE.max}
                onChange={(n) => setPwOption('length', n)}
              />
              <Switch label="Uppercase" hint="A–Z" value={pw.uppercase} onChange={(v) => setPwOption('uppercase', v)} />
              <Switch label="Lowercase" hint="a–z" value={pw.lowercase} onChange={(v) => setPwOption('lowercase', v)} />
              <Switch label="Numbers" hint="0–9" value={pw.numbers} onChange={(v) => setPwOption('numbers', v)} />
              <Switch label="Symbols" hint="!@#$" value={pw.symbols} onChange={(v) => setPwOption('symbols', v)} />
              <Switch label="Avoid look-alikes" hint="l 1 O 0" value={pw.avoidLookAlikes} onChange={(v) => setPwOption('avoidLookAlikes', v)} />
            </>
          ) : mode === 'passphrase' ? (
            <>
              <Stepper
                label="Words"
                unit="words"
                value={phrase.words}
                min={PASSPHRASE_WORDS_RANGE.min}
                max={PASSPHRASE_WORDS_RANGE.max}
                onChange={(n) => setPhrase((p) => ({ ...p, words: n }))}
              />
              <Switch label="Capitalise" hint="Copper" value={phrase.capitalize} onChange={(v) => setPhrase((p) => ({ ...p, capitalize: v }))} />
              <Switch label="Add a number" hint="Copper7" value={phrase.includeNumber} onChange={(v) => setPhrase((p) => ({ ...p, includeNumber: v }))} />
              <Switch
                label="Separate with spaces"
                hint="instead of -"
                value={phrase.separator === ' '}
                onChange={(v) => setPhrase((p) => ({ ...p, separator: v ? ' ' : '-' }))}
              />
            </>
          ) : (
            <Stepper label="Length" unit="digits" value={pinLength} min={PIN_LENGTH_RANGE.min} max={PIN_LENGTH_RANGE.max} onChange={setPinLength} />
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label={toForm ? `Use this ${noun}` : `Copy ${noun}`} icon={toForm ? 'check' : 'copy'} onPress={finish} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingTop: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.xl, paddingRight: space.sm },
  content: { paddingHorizontal: space.xl, gap: space.md + 2, paddingBottom: space.xl },
  output: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.group - 2, paddingLeft: space.lg + 2, paddingRight: space.xs, paddingVertical: space.sm, minHeight: 104 },
  outputText: { flex: 1, fontFamily: MONO, fontWeight: '600', fontSize: 21, lineHeight: 30, letterSpacing: 0.5 },
  optionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderBottomWidth: 1, gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.sm },
});

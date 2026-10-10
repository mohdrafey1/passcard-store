import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Badge, Toggle } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Banner, Screen } from '@/components/ui/Layout';
import { useOnboarding } from '@/features/onboarding/state';
import { useSettingsStore } from '@/features/settings/store';
import { counted } from '@/features/vault/items';
import { radius, space, useTheme } from '@/theme';

type Choice = 'pin6' | 'passphrase' | 'pin4';

const OPTIONS: { id: Choice; title: string; body: string; tag?: string }[] = [
  { id: 'pin6', title: '6-digit PIN', body: 'Quick to type. Pairs well with fingerprint unlock.', tag: 'Recommended' },
  { id: 'passphrase', title: 'Passphrase', body: 'Letters, numbers or words. The strongest choice.' },
  { id: 'pin4', title: '4-digit PIN', body: 'Fastest, and the easiest to guess.' },
];

export default function SetupScreen() {
  const c = useTheme();
  const { method, pinLength, fingerprint, pendingRestore, setChoice } = useOnboarding();
  const biometricsAvailable = useSettingsStore((s) => s.biometricsAvailable);
  const current: Choice = method === 'passphrase' ? 'passphrase' : pinLength === 4 ? 'pin4' : 'pin6';

  const pick = (id: Choice) =>
    setChoice(id === 'passphrase' ? { method: 'passphrase' } : { method: 'pin', pinLength: id === 'pin4' ? 4 : 6 });

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
        <View style={styles.progress} accessible accessibilityLabel="Step 1 of 2">
          <View style={[styles.step, { backgroundColor: c.brass }]} />
          <View style={[styles.step, { backgroundColor: c.line }]} />
        </View>
        <AppText variant="caption" tone="muted">
          1 of 2
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: space.sm }}>
          <AppText variant="title" accessibilityRole="header">
            How do you want to unlock?
          </AppText>
          <AppText variant="body" tone="ink2">
            You&apos;ll use this each time you open the vault.
          </AppText>
        </View>

        {pendingRestore ? (
          <Banner
            tone="info"
            icon="archive"
            title="Your backup is ready"
            body={`${counted(pendingRestore.passwords.length, 'login')} and ${counted(pendingRestore.cards.length, 'card')} go into the vault once it's set up.`}
          />
        ) : null}

        <View accessibilityRole="radiogroup" accessibilityLabel="Unlock method" style={{ gap: space.sm + 2 }}>
          {OPTIONS.map((o) => {
            const on = current === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => pick(o.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${o.title}. ${o.body}${o.tag ? ` ${o.tag}` : ''}`}
                style={[styles.option, { backgroundColor: c.surface, borderColor: on ? c.brass : c.line, borderWidth: on ? 2 : 1 }]}
              >
                <View style={[styles.radio, { borderColor: on ? c.brass : c.muted }]}>
                  {on ? <View style={[styles.radioDot, { backgroundColor: c.brass }]} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.titleLine}>
                    <AppText variant="bodyStrong">{o.title}</AppText>
                    {o.tag ? <Badge label={o.tag} /> : null}
                  </View>
                  <AppText variant="caption" tone="ink2" style={{ fontSize: 14, lineHeight: 20, fontWeight: '500' }}>
                    {o.body}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {biometricsAvailable ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={styles.titleLine}>
              <View style={[styles.tile, { backgroundColor: c.raised }]}>
                <Icon name="fingerprint" size={20} color={c.brassText} />
              </View>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                Unlock with fingerprint
              </AppText>
              <Toggle value={fingerprint} onValueChange={(v) => setChoice({ fingerprint: v })} label="Unlock with fingerprint" />
            </View>
            <AppText variant="caption" tone="ink2" style={{ fontSize: 14, lineHeight: 20, fontWeight: '500' }}>
              Your key stays in Android&apos;s hardware keystore and is released only after a fingerprint match.
            </AppText>
          </View>
        ) : null}

        <Banner tone="warn" title="There's no “Forgot PIN”" body="Make an encrypted backup once you're in. We'll remind you every month." />
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Continue" onPress={() => router.push('/create-secret')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, paddingTop: space.sm },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  step: { flex: 1, height: 4, borderRadius: 2 },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxxl },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2, padding: space.lg, borderRadius: radius.row },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: { borderWidth: 1, borderRadius: radius.row, padding: space.lg, gap: space.sm },
  tile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.lg },
});

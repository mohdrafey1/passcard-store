import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Layout';
import { LINKS } from '@/constants/links';
import { openInfoPage } from '@/utils/open-link';
import { useOnboarding } from '@/features/onboarding/state';
import { radius, space, useTheme } from '@/theme';

const PROMISES: { icon: IconName; title: string; body: string; warn?: boolean }[] = [
  { icon: 'lock', title: 'Encrypted on this device', body: 'AES-256. Only your PIN or fingerprint opens it.' },
  { icon: 'wifi-off', title: 'No account, no cloud', body: 'Nothing is uploaded. No sign-up, no tracking.' },
  {
    icon: 'key',
    title: 'You hold the only key',
    body: 'Forget your PIN with no backup and nobody can open the vault, not even us.',
    warn: true,
  },
];

export default function WelcomeScreen() {
  const c = useTheme();
  const reset = useOnboarding((s) => s.reset);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={require('@/assets/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors accessibilityLabel="Passcard Store" />
          <AppText variant="display" align="center" accessibilityRole="header">
            Your passwords and cards, locked to this phone.
          </AppText>
        </View>

        <View style={[styles.promises, { backgroundColor: c.surface, borderColor: c.line }]}>
          {PROMISES.map((p, i) => (
            <View
              key={p.title}
              style={[styles.promise, i < PROMISES.length - 1 && { borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth * 2 }]}
              accessible
              accessibilityLabel={`${p.title}. ${p.body}`}
            >
              <View style={[styles.promiseIcon, { backgroundColor: p.warn ? c.warnSoft : c.raised }]}>
                <Icon name={p.icon} size={20} color={p.warn ? c.warnText : c.brassText} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">{p.title}</AppText>
                <AppText variant="caption" tone="ink2" style={{ fontWeight: '500', fontSize: 14, lineHeight: 20 }}>
                  {p.body}
                </AppText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            label="Set up my vault"
            onPress={() => {
              reset();
              router.push('/setup');
            }}
          />
          <Button label="I have a backup file" variant="secondary" onPress={() => router.push('/restore')} />
          <AppText variant="caption" tone="muted" align="center" style={{ marginTop: space.xs }}>
            By continuing you accept the{' '}
            <AppText variant="caption" tone="brass" onPress={() => openInfoPage(LINKS.terms)} accessibilityRole="link">
              Terms
            </AppText>{' '}
            and{' '}
            <AppText variant="caption" tone="brass" onPress={() => openInfoPage(LINKS.privacy)} accessibilityRole="link">
              Privacy Policy
            </AppText>
            .
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space.xxl, paddingTop: space.huge, gap: space.xxxl },
  hero: { alignItems: 'center', gap: space.xxl },
  logo: { width: 116, height: 116, borderRadius: 26 },
  promises: { borderRadius: radius.group, borderWidth: 1, paddingHorizontal: space.lg + 2 },
  promise: { flexDirection: 'row', gap: space.md + 2, paddingVertical: space.md + 2 },
  promiseIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: 'auto', gap: space.sm + 2 },
});

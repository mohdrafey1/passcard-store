import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Badge, Toggle } from '@/components/ui/Controls';
import { Group, Row, Screen, SectionTitle } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { ReauthModal } from '@/components/ReauthModal';
import { LINKS } from '@/constants/links';
import { openInfoPage } from '@/utils/open-link';
import { eraseVault, lockVault } from '@/features/session/session';
import { useSettingsStore } from '@/features/settings/store';
import { backupNudge, relativeAge } from '@/features/vault/items';
import { getBiometricLabel } from '@/security/biometrics';
import { WIPE_THRESHOLD } from '@/security/lockout';
import { cardRepository } from '@/storage/card-repository';
import { passwordRepository } from '@/storage/password-repository';
import { space } from '@/theme';
import { AUTO_LOCK_OPTIONS, BACKUP_REMINDER_OPTIONS, CLIPBOARD_CLEAR_OPTIONS, THEME_OPTIONS } from '@/types/settings';

type Picker = 'autolock' | 'clipboard' | 'theme' | null;

export default function SettingsScreen() {
  const s = useSettingsStore();
  const [picker, setPicker] = useState<Picker>(null);
  const [eraseAuth, setEraseAuth] = useState(false);
  const [bioLabel, setBioLabel] = useState('Fingerprint');
  const [deletedCount, setDeletedCount] = useState(0);
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    getBiometricLabel().then(setBioLabel);
  }, []);

  useFocusEffect(
    useCallback(() => {
      Promise.all([passwordRepository.countDeleted(), cardRepository.countDeleted()]).then(([a, b]) => setDeletedCount(a + b));
      Promise.all([passwordRepository.count(), cardRepository.count()]).then(([a, b]) => setItemCount(a + b));
    }, []),
  );

  const unlockLabel = s.unlockMethod === 'passphrase' ? 'Passphrase' : `${s.pinLength}-digit PIN`;
  const reminderDays = BACKUP_REMINDER_OPTIONS.find((o) => o.value === s.backupReminder)?.days ?? null;
  const nudge = backupNudge(s.lastBackupAt, reminderDays, itemCount);
  const backupValue = s.lastBackupAt ? relativeAge(s.lastBackupAt) : 'Never';

  const toggleBiometrics = async (enabled: boolean) => {
    try {
      await s.setBiometrics(enabled);
    } catch {
      // Cancelled at the system prompt: nothing changed.
    }
  };

  const toggleWipe = (enabled: boolean) => {
    if (!enabled) {
      void s.update('wipeAfterFailures', false);
      return;
    }
    Alert.alert(
      `Erase after ${WIPE_THRESHOLD} wrong tries?`,
      `If someone (or you) enters a wrong ${s.unlockMethod === 'pin' ? 'PIN' : 'passphrase'} ${WIPE_THRESHOLD} times in a row, everything in the vault is deleted. Only turn this on if you have a recent backup.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn on', style: 'destructive', onPress: () => void s.update('wipeAfterFailures', true) },
      ],
    );
  };

  const confirmErase = () =>
    Alert.alert('Erase the vault?', 'Every login, card and setting on this phone is deleted. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: () => setEraseAuth(true) },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="display" accessibilityRole="header">
          Settings
        </AppText>

        <SectionTitle>Security</SectionTitle>
        <Group>
          <Row icon="key" label="Unlock method" value={unlockLabel} onPress={() => router.push('/settings/unlock-method')} />
          {s.biometricsAvailable ? (
            <Row
              icon="fingerprint"
              label={`${bioLabel} unlock`}
              accessory={<Toggle value={s.biometricsEnabled} onValueChange={toggleBiometrics} label={`${bioLabel} unlock`} />}
            />
          ) : (
            <Row icon="fingerprint" label="Fingerprint unlock" detail="Add a fingerprint in your phone’s settings to use it here." />
          )}
          <Row
            icon="clock"
            label="Auto-lock"
            value={AUTO_LOCK_OPTIONS.find((o) => o.value === s.autoLockDuration)?.label}
            onPress={() => setPicker('autolock')}
          />
          <Row
            icon="clipboard"
            label="Clear clipboard"
            value={CLIPBOARD_CLEAR_OPTIONS.find((o) => o.value === s.clipboardClearDuration)?.label}
            onPress={() => setPicker('clipboard')}
          />
          <Row
            icon="shield-alert"
            label={`Erase after ${WIPE_THRESHOLD} tries`}
            detail={`Wipes the vault after ${WIPE_THRESHOLD} wrong attempts in a row`}
            accessory={<Toggle value={s.wipeAfterFailures} onValueChange={toggleWipe} label={`Erase after ${WIPE_THRESHOLD} wrong attempts`} />}
          />
          <Row icon="lock" label="Lock now" tone="brass" chevron={false} onPress={lockVault} />
        </Group>

        <SectionTitle>Appearance</SectionTitle>
        <Group>
          <Row icon="moon" label="Theme" value={THEME_OPTIONS.find((o) => o.value === s.theme)?.label} onPress={() => setPicker('theme')} />
        </Group>

        <SectionTitle>Your data</SectionTitle>
        <Group>
          <Row
            icon="archive"
            label="Backup & restore"
            value={backupValue}
            tone={nudge.due ? 'warn' : 'default'}
            onPress={() => router.push('/settings/backup')}
          />
          <Row icon="download" label="Import from other apps" onPress={() => router.push('/settings/import')} />
          <Row icon="upload" label="Export as CSV" value="Not encrypted" onPress={() => router.push('/settings/export')} />
          <Row
            icon="trash-2"
            label="Recently deleted"
            value={deletedCount ? `${deletedCount} item${deletedCount === 1 ? '' : 's'}` : 'Empty'}
            onPress={() => router.push('/settings/deleted')}
          />
          <Row icon="tag" label="Categories" value={`${s.categories.length}`} onPress={() => router.push('/settings/categories')} />
        </Group>

        <SectionTitle>About</SectionTitle>
        <Group>
          <Row label="Privacy policy" accessory={<Badge label="Web" tone="muted" />} onPress={() => openInfoPage(LINKS.privacy)} />
          <Row label="Terms of use" accessory={<Badge label="Web" tone="muted" />} onPress={() => openInfoPage(LINKS.terms)} />
          <Row label="Source code on GitHub" accessory={<Badge label="Web" tone="muted" />} onPress={() => openInfoPage(LINKS.source)} />
        </Group>

        <Button label="Erase vault" variant="danger" icon="trash-2" onPress={confirmErase} style={{ marginTop: space.xxl }} />
        <AppText variant="caption" tone="muted" align="center" style={{ marginTop: space.md }}>
          Passcard Store {Constants.expoConfig?.version ?? ''} · works fully offline
        </AppText>
      </ScrollView>

      <Sheet
        visible={picker === 'autolock'}
        onClose={() => setPicker(null)}
        title="Auto-lock"
        subtitle="Lock after leaving the app"
        choice
        options={AUTO_LOCK_OPTIONS.map((o) => ({
          label: o.label,
          selected: o.value === s.autoLockDuration,
          onPress: () => void s.update('autoLockDuration', o.value),
        }))}
      />
      <Sheet
        visible={picker === 'clipboard'}
        onClose={() => setPicker(null)}
        title="Clear clipboard"
        subtitle="After copying a password or card number"
        choice
        options={CLIPBOARD_CLEAR_OPTIONS.map((o) => ({
          label: o.label,
          selected: o.value === s.clipboardClearDuration,
          onPress: () => void s.update('clipboardClearDuration', o.value),
        }))}
      />
      <Sheet
        visible={picker === 'theme'}
        onClose={() => setPicker(null)}
        title="Theme"
        choice
        options={THEME_OPTIONS.map((o) => ({ label: o.label, selected: o.value === s.theme, onPress: () => void s.update('theme', o.value) }))}
      />
      <ReauthModal
        visible={eraseAuth}
        reason="erase the vault"
        onClose={() => setEraseAuth(false)}
        onVerified={async () => {
          setEraseAuth(false);
          await eraseVault();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingTop: space.lg, paddingBottom: space.huge },
});

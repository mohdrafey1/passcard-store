import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Banner, Group, Row } from '@/components/ui/Layout';
import { ReauthModal } from '@/components/ReauthModal';
import { useCardStore } from '@/features/cards/store';
import { exportAndShareCSV, exportCardsToCSV, exportPasswordsToCSV } from '@/features/import-export/csv-handler';
import { usePasswordStore } from '@/features/passwords/store';
import { space } from '@/theme';

export default function ExportScreen() {
  const passwords = usePasswordStore((s) => s.passwords);
  const cards = useCardStore((s) => s.cards);
  const [pending, setPending] = useState<'logins' | 'cards' | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (kind: 'logins' | 'cards') => {
    setBusy(true);
    try {
      if (kind === 'logins') await exportAndShareCSV(exportPasswordsToCSV(passwords), 'passcard-logins.csv');
      else await exportAndShareCSV(exportCardsToCSV(cards), 'passcard-cards.csv');
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Banner
        tone="danger"
        icon="alert-triangle"
        title="CSV files are not encrypted"
        body="Anyone who opens the file can read every password and card number. To move to a new phone, use an encrypted backup instead."
      />
      <Button label="Make an encrypted backup instead" variant="secondary" icon="archive" onPress={() => router.replace('/settings/backup')} />
      <AppText variant="body" tone="ink2">
        Use CSV to move to another password manager. Delete the file as soon as you&apos;ve imported it.
      </AppText>
      <Group>
        <Row
          icon="key"
          label="Export logins"
          value={`${passwords.length}`}
          onPress={() => (passwords.length ? setPending('logins') : Alert.alert('Nothing to export', 'There are no logins yet.'))}
        />
        <Row
          icon="credit-card"
          label="Export cards"
          value={`${cards.length}`}
          onPress={() => (cards.length ? setPending('cards') : Alert.alert('Nothing to export', 'There are no cards yet.'))}
        />
      </Group>
      {busy ? <AppText variant="caption" tone="muted">Preparing the file…</AppText> : null}
      <ReauthModal
        visible={pending !== null}
        reason="export unencrypted"
        onClose={() => setPending(null)}
        onVerified={() => {
          const kind = pending;
          setPending(null);
          if (kind) void run(kind);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md + 2, paddingBottom: space.huge },
});

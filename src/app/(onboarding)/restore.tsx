import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Banner, Screen } from '@/components/ui/Layout';
import { decryptBackup, detectBackupKind, readBackupFile, type BackupKind } from '@/features/import-export/backup-handler';
import { useOnboarding } from '@/features/onboarding/state';
import { space } from '@/theme';
import { cleanupTempFile } from '@/utils/cache';

export default function RestoreFirstScreen() {
  const setPendingRestore = useOnboarding((s) => s.setPendingRestore);
  const [file, setFile] = useState<{ name: string; content: string; kind: BackupKind } | null>(null);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setError(null);
    const doc = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (doc.canceled) return;
    const asset = doc.assets[0];
    try {
      const content = await readBackupFile(asset.uri);
      const kind = detectBackupKind(content);
      if (kind === 'unknown') {
        setError('That file isn’t a Passcard Store backup. Backups end in .pcbackup (older ones in .txt).');
        return;
      }
      setFile({ name: asset.name, content, kind });
      setSecret('');
    } finally {
      cleanupTempFile(asset.uri);
    }
  };

  const open = async () => {
    if (!file || !secret) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await decryptBackup(file.content, secret);
      setPendingRestore(payload);
      setSecret('');
      router.replace('/setup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the backup.');
    } finally {
      setBusy(false);
    }
  };

  const legacy = file?.kind === 'legacy';

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
      </View>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="title" accessibilityRole="header">
            Restore from a backup
          </AppText>
          <AppText variant="body" tone="ink2">
            Choose your backup file. After it opens, you&apos;ll pick how to unlock this vault.
          </AppText>

          <Button
            label={file ? `Chosen: ${file.name}` : 'Choose backup file'}
            variant={file ? 'secondary' : 'primary'}
            icon="file"
            onPress={pick}
          />

          {file ? (
            <>
              <Field
                label={legacy ? 'PIN used when this backup was made' : 'Backup password'}
                value={secret}
                onChangeText={(t) => {
                  setSecret(t);
                  setError(null);
                }}
                secureTextEntry
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={legacy ? 'number-pad' : 'default'}
                onSubmitEditing={open}
                returnKeyType="go"
                hint={legacy ? 'This backup was made before version 1.3 and is protected by the PIN you had then.' : null}
              />
              <Button label="Open backup" onPress={open} loading={busy} disabled={!secret} />
            </>
          ) : null}

          {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.sm, paddingTop: space.sm },
  content: { padding: space.xl, gap: space.lg },
});

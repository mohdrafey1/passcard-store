import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import {
  applyBackup,
  backupCategories,
  buildBackup,
  decryptBackup,
  detectBackupKind,
  hasBackupPassword,
  MIN_BACKUP_PASSWORD_LENGTH,
  readBackupFile,
  saveBackupToFolder,
  setBackupPassword,
  shareBackup,
  type BackupPayload,
} from '@/features/import-export/backup-handler';
import { useCardStore } from '@/features/cards/store';
import { usePasswordStore } from '@/features/passwords/store';
import { useSettingsStore } from '@/features/settings/store';
import { runWithoutAutoLock } from '@/utils/auto-lock-guard';
import PinModal from '@/components/PinModal';

type Mode = 'menu' | 'set-password' | 'restore-secret';

export default function BackupScreen() {
  const [mode, setMode] = useState<Mode>('menu');
  const [busy, setBusy] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [reauthVisible, setReauthVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [restoreContent, setRestoreContent] = useState('');
  const [restoreSecret, setRestoreSecret] = useState('');
  const settings = useSettingsStore();

  const refresh = useCallback(() => {
    hasBackupPassword().then(setHasPassword);
  }, []);
  useEffect(refresh, [refresh]);

  const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleDateString() : 'Never';

  const createBackup = async (destination: 'folder' | 'share') => {
    setBusy(true);
    try {
      const backup = await buildBackup({
        autoLockDuration: settings.autoLockDuration,
        clipboardClearDuration: settings.clipboardClearDuration,
        categories: settings.categories,
      });
      if (destination === 'folder') {
        const saved = await saveBackupToFolder(backup);
        if (!saved) return;
        Alert.alert('Backup saved', `${backup.passwords} logins and ${backup.cards} cards saved as ${backup.filename}.`);
      } else {
        await shareBackup(backup);
      }
      await settings.update('lastBackupAt', new Date().toISOString());
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
      Alert.alert('Too short', `Use at least ${MIN_BACKUP_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords differ', 'Type the same backup password twice.');
      return;
    }
    setBusy(true);
    try {
      await setBackupPassword(password);
      setPassword('');
      setConfirm('');
      setMode('menu');
      refresh();
      Alert.alert('Backup password set', 'You will need it to restore. Store it somewhere other than this phone.');
    } finally {
      setBusy(false);
    }
  };

  const pickRestoreFile = async () => {
    const doc = await runWithoutAutoLock(() =>
      DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false }),
    );
    if (doc.canceled) return;
    const content = await readBackupFile(doc.assets[0].uri);
    if (detectBackupKind(content) === 'unknown') {
      Alert.alert('Not a backup', 'This file is not a Passcard Store backup.');
      return;
    }
    setRestoreContent(content);
    setRestoreSecret('');
    setMode('restore-secret');
  };

  const apply = async (payload: BackupPayload, restoreMode: 'replace' | 'merge') => {
    setBusy(true);
    try {
      const result = await applyBackup(payload, restoreMode);
      const categories = backupCategories(payload);
      if (categories) {
        await settings.update('categories', [...new Set([...settings.categories, ...categories])]);
      }
      await Promise.all([usePasswordStore.getState().load(), useCardStore.getState().load()]);
      Alert.alert(
        'Restored',
        `${result.passwords} logins and ${result.cards} cards restored.` +
          (result.keptNewer ? ` ${result.keptNewer} kept from this phone because they were newer.` : ''),
      );
      setMode('menu');
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    let payload: BackupPayload;
    try {
      payload = await decryptBackup(restoreContent, restoreSecret);
    } catch (e) {
      setBusy(false);
      Alert.alert('Could not open backup', e instanceof Error ? e.message : 'Check the password.');
      return;
    }
    setBusy(false);
    Alert.alert(
      'Restore backup',
      `${payload.passwords.length} logins and ${payload.cards.length} cards in this backup.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', onPress: () => apply(payload, 'merge') },
        { text: 'Replace all', style: 'destructive', onPress: () => apply(payload, 'replace') },
      ],
    );
  };

  const isLegacy = detectBackupKind(restoreContent) === 'legacy';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (mode === 'menu' ? router.back() : setMode('menu'))} accessibilityLabel="Go back" accessibilityRole="button" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup & Restore</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {mode === 'menu' && (
          <>
            <Text style={styles.status}>Last backup: {lastBackup}</Text>
            {hasPassword ? (
              <>
                <TouchableOpacity style={styles.primary} onPress={() => createBackup('folder')} disabled={busy}>
                  <Text style={styles.primaryText}>Save encrypted backup to a folder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondary} onPress={() => createBackup('share')} disabled={busy}>
                  <Text style={styles.secondaryText}>Share encrypted backup…</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.link} onPress={() => setReauthVisible(true)}>
                  <Text style={styles.linkText}>Change backup password</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.note}>
                  Backups are protected by their own password, not your PIN, so a leaked file can&apos;t be opened by guessing digits.
                </Text>
                <TouchableOpacity style={styles.primary} onPress={() => setReauthVisible(true)}>
                  <Text style={styles.primaryText}>Set a backup password</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.secondary, { marginTop: Spacing.xl }]} onPress={pickRestoreFile} disabled={busy}>
              <Text style={styles.secondaryText}>Restore from a backup file</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'set-password' && (
          <>
            <Text style={styles.label}>Backup password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="Backup password" />
            <Text style={styles.label}>Type it again</Text>
            <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="Confirm backup password" />
            <Text style={styles.note}>At least {MIN_BACKUP_PASSWORD_LENGTH} characters. Nobody can recover it for you.</Text>
            <TouchableOpacity style={styles.primary} onPress={savePassword} disabled={busy}>
              <Text style={styles.primaryText}>Save backup password</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'restore-secret' && (
          <>
            <Text style={styles.label}>{isLegacy ? 'PIN used when this backup was made' : 'Backup password'}</Text>
            <TextInput
              style={styles.input}
              value={restoreSecret}
              onChangeText={setRestoreSecret}
              secureTextEntry
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={isLegacy ? 'number-pad' : 'default'}
              accessibilityLabel={isLegacy ? 'Backup PIN' : 'Backup password'}
            />
            <TouchableOpacity style={styles.primary} onPress={restore} disabled={busy || !restoreSecret}>
              <Text style={styles.primaryText}>Open backup</Text>
            </TouchableOpacity>
          </>
        )}
        {busy && <ActivityIndicator style={{ marginTop: Spacing.xl }} size="large" color={Colors.primary} />}
      </ScrollView>

      <PinModal
        visible={reauthVisible}
        title="Confirm it's you"
        onVerified={() => {
          setReauthVisible(false);
          setMode('set-password');
        }}
        onClose={() => setReauthVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  back: { padding: Spacing.sm },
  headerTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  content: { padding: Spacing.base, gap: Spacing.md },
  status: { fontSize: FontSize.base, color: Colors.textSecondary },
  note: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  input: { minHeight: 52, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, paddingHorizontal: Spacing.base, fontSize: FontSize.md, color: Colors.text },
  primary: { minHeight: 52, borderRadius: BorderRadius.md, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.base },
  primaryText: { color: Colors.white, fontSize: FontSize.base, fontWeight: '700' },
  secondary: { minHeight: 52, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: Colors.text, fontSize: FontSize.base, fontWeight: '600' },
  link: { padding: Spacing.sm, alignItems: 'center' },
  linkText: { color: Colors.textSecondary, fontSize: FontSize.base, fontWeight: '600' },
});

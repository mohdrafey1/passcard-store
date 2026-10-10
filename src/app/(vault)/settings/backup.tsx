import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { StrengthMeter } from '@/components/ui/Controls';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Banner, Group, Row, SectionTitle } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { showToast } from '@/components/ui/Toast';
import { ReauthModal } from '@/components/ReauthModal';
import { useCardStore } from '@/features/cards/store';
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
  type BackupKind,
  type BackupPayload,
} from '@/features/import-export/backup-handler';
import { usePasswordStore } from '@/features/passwords/store';
import { useSettingsStore } from '@/features/settings/store';
import { backupNudge, counted, formatDate, relativeAge } from '@/features/vault/items';
import { radius, space, useTheme } from '@/theme';
import { BACKUP_REMINDER_OPTIONS } from '@/types/settings';
import { runWithoutAutoLock } from '@/utils/auto-lock-guard';
import { cleanupTempFile } from '@/utils/cache';
import { measureStrength } from '@/utils/strength';

type Mode = 'main' | 'password' | 'restore';

export default function BackupScreen() {
  const c = useTheme();
  const settings = useSettingsStore();
  const passwords = usePasswordStore((s) => s.passwords);
  const cards = useCardStore((s) => s.cards);
  const [mode, setMode] = useState<Mode>('main');
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [reauth, setReauth] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  // Backup password form
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const pwStrength = useMemo(() => measureStrength(pw), [pw]);

  // Restore
  const [file, setFile] = useState<{ name: string; content: string; kind: BackupKind } | null>(null);
  const [secret, setSecret] = useState('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    hasBackupPassword().then(setHasPassword);
  }, []);
  useEffect(refresh, [refresh]);

  const reminderDays = BACKUP_REMINDER_OPTIONS.find((o) => o.value === settings.backupReminder)?.days ?? null;
  const nudge = backupNudge(settings.lastBackupAt, reminderDays, passwords.length + cards.length);

  const create = async (destination: 'folder' | 'share') => {
    setBusy(true);
    try {
      const backup = await buildBackup({
        autoLockDuration: settings.autoLockDuration,
        clipboardClearDuration: settings.clipboardClearDuration,
        categories: settings.categories,
      });
      if (destination === 'folder') {
        if (!(await saveBackupToFolder(backup))) return;
        showToast('Backup saved', backup.filename);
      } else {
        await shareBackup(backup);
        showToast('Backup handed to the share sheet', 'check it was saved');
      }
      await settings.update('lastBackupAt', new Date().toISOString());
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Nothing was saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (pw.length < MIN_BACKUP_PASSWORD_LENGTH) return setPwError(`Use at least ${MIN_BACKUP_PASSWORD_LENGTH} characters.`);
    if (pwStrength.score < 3) return setPwError(pwStrength.hint ?? 'Too easy to guess. Make it longer or less predictable.');
    if (pw !== pw2) return setPwError('Type the same password twice.');
    setBusy(true);
    try {
      await setBackupPassword(pw);
      setPw('');
      setPw2('');
      setMode('main');
      refresh();
      showToast('Backup password saved');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    setRestoreError(null);
    const doc = await runWithoutAutoLock(() =>
      DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false }),
    );
    if (doc.canceled) return;
    const asset = doc.assets[0];
    try {
      const content = await readBackupFile(asset.uri);
      const kind = detectBackupKind(content);
      if (kind === 'unknown') {
        setRestoreError('That file isn’t a Passcard Store backup. Backups end in .pcbackup (older ones in .txt).');
        return;
      }
      setFile({ name: asset.name, content, kind });
      setSecret('');
      setMode('restore');
    } finally {
      cleanupTempFile(asset.uri);
    }
  };

  const apply = async (payload: BackupPayload) => {
    setBusy(true);
    try {
      const result = await applyBackup(payload, restoreMode);
      const categories = backupCategories(payload);
      if (categories) await settings.update('categories', [...new Set([...settings.categories, ...categories])]);
      await Promise.all([usePasswordStore.getState().load(), useCardStore.getState().load()]);
      setMode('main');
      setFile(null);
      const changed = result.passwords + result.cards;
      Alert.alert(
        'Backup restored',
        (changed || restoreMode === 'replace'
          ? `${counted(result.passwords, 'login')} and ${counted(result.cards, 'card')} ${restoreMode === 'merge' ? 'added or updated' : 'restored'}.`
          : 'Everything in the backup is already in this vault.') +
          (result.keptNewer
            ? ` Kept ${counted(result.keptNewer, 'item')} from this phone because ${result.keptNewer === 1 ? 'it was' : 'they were'} edited more recently.`
            : ''),
      );
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  const openBackup = async () => {
    if (!file || !secret) return;
    setBusy(true);
    setRestoreError(null);
    let payload: BackupPayload;
    try {
      payload = await decryptBackup(file.content, secret);
    } catch (e) {
      setBusy(false);
      setRestoreError(e instanceof Error ? e.message : 'Could not open the backup.');
      return;
    }
    setBusy(false);
    setSecret('');
    const when = payload.timestamp ? ` from ${formatDate(payload.timestamp)}` : '';
    Alert.alert(
      restoreMode === 'merge' ? 'Merge this backup?' : 'Replace everything?',
      `The backup${when} has ${counted(payload.passwords.length, 'login')} and ${counted(payload.cards.length, 'card')}.` +
        (restoreMode === 'replace'
          ? ' Everything currently in this vault is removed first.'
          : ' Items you edited more recently on this phone are kept.'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: restoreMode === 'merge' ? 'Merge' : 'Replace',
          style: restoreMode === 'replace' ? 'destructive' : 'default',
          onPress: () => void apply(payload),
        },
      ],
    );
  };

  if (mode === 'password') {
    return (
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="headline" accessibilityRole="header">
            {hasPassword ? 'New backup password' : 'Set a backup password'}
          </AppText>
          <AppText variant="body" tone="ink2">
            Backups are locked with this password, not your PIN. You&apos;ll need it to restore on a new phone, so keep it somewhere other
            than this phone. Nobody can recover it for you.
          </AppText>
          <Field
            label="Backup password"
            value={pw}
            onChangeText={(t) => {
              setPw(t);
              setPwError(null);
            }}
            secureTextEntry
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            hint={`At least ${MIN_BACKUP_PASSWORD_LENGTH} characters`}
          />
          {pw ? <StrengthMeter score={pwStrength.score} label={pwStrength.label} detail={pwStrength.hint ?? undefined} /> : null}
          <Field
            label="Type it again"
            value={pw2}
            onChangeText={(t) => {
              setPw2(t);
              setPwError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            error={pwError}
            onSubmitEditing={savePassword}
          />
          {hasPassword ? (
            <AppText variant="caption" tone="muted">
              Backups you made before keep their old password.
            </AppText>
          ) : null}
          <Button label="Save backup password" onPress={savePassword} loading={busy} />
          <Button label="Cancel" variant="quiet" onPress={() => setMode('main')} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (mode === 'restore' && file) {
    const legacy = file.kind === 'legacy';
    return (
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.fileCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="file" size={20} color={c.brassText} />
            <AppText variant="label" numberOfLines={1} style={{ flex: 1 }}>
              {file.name}
            </AppText>
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Restore mode"
            style={[styles.radioGroup, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            {(
              [
                ['merge', 'Merge with this vault', 'Adds what’s missing; keeps whichever copy was edited last'],
                ['replace', 'Replace this vault', 'Removes everything here first'],
              ] as const
            ).map(([value, title, body], i) => {
              const on = restoreMode === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRestoreMode(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[styles.radioRow, i === 0 && { borderBottomColor: c.line, borderBottomWidth: 1 }]}
                >
                  <View style={[styles.radio, { borderColor: on ? c.brass : c.muted }]}>
                    {on ? <View style={[styles.radioDot, { backgroundColor: c.brass }]} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{title}</AppText>
                    <AppText variant="caption" tone="muted">
                      {body}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Field
            label={legacy ? 'PIN used when this backup was made' : 'Backup password'}
            value={secret}
            onChangeText={(t) => {
              setSecret(t);
              setRestoreError(null);
            }}
            secureTextEntry
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={legacy ? 'number-pad' : 'default'}
            hint={legacy ? 'Made before version 1.3, so it uses the PIN you had then.' : null}
            onSubmitEditing={openBackup}
          />
          {restoreError ? <Banner tone="danger" icon="alert-circle" title={restoreError} /> : null}
          <Button label="Open backup" onPress={openBackup} loading={busy} disabled={!secret} />
          <Button label="Cancel" variant="quiet" onPress={() => setMode('main')} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Banner
        tone={nudge.due ? 'warn' : 'info'}
        icon={nudge.due ? 'shield-alert' : 'shield-check'}
        title={settings.lastBackupAt ? `Last backup ${relativeAge(settings.lastBackupAt)}` : 'No backup yet'}
        body={
          settings.lastBackupAt
            ? `${formatDate(settings.lastBackupAt)} · now ${counted(passwords.length, 'login')}, ${counted(cards.length, 'card')}`
            : `${counted(passwords.length, 'login')} and ${counted(cards.length, 'card')} exist only on this phone.`
        }
      />

      {hasPassword === false ? (
        <>
          <AppText variant="body" tone="ink2">
            Backups have their own long password, separate from your {settings.unlockMethod === 'passphrase' ? 'passphrase' : 'PIN'}, so a
            file that leaks can’t be cracked quickly. Set it once; backups after that are one tap.
          </AppText>
          <Button label="Set a backup password" onPress={() => setReauth(true)} />
        </>
      ) : hasPassword ? (
        <>
          <Button label="Save backup to a folder" icon="folder" onPress={() => create('folder')} loading={busy} />
          <Button label="Share backup…" variant="secondary" icon="share-2" onPress={() => create('share')} disabled={busy} />
        </>
      ) : null}

      <SectionTitle>Settings</SectionTitle>
      <Group>
        <Row
          icon="key"
          label="Backup password"
          value={hasPassword ? 'Set' : 'Not set'}
          tone={hasPassword ? 'default' : 'warn'}
          onPress={() => setReauth(true)}
        />
        <Row
          icon="bell"
          label="Remind me"
          value={BACKUP_REMINDER_OPTIONS.find((o) => o.value === settings.backupReminder)?.label}
          onPress={() => setReminderOpen(true)}
        />
      </Group>

      <SectionTitle>Restore</SectionTitle>
      <Button label="Restore from a backup file" variant="secondary" icon="download" onPress={pickFile} />
      {restoreError ? <Banner tone="danger" icon="alert-circle" title={restoreError} /> : null}
      <AppText variant="caption" tone="muted">
        Works with .pcbackup files and with backups made by earlier versions.
      </AppText>

      <Sheet
        visible={reminderOpen}
        onClose={() => setReminderOpen(false)}
        title="Backup reminder"
        subtitle="A banner on the Vault when a backup is due"
        choice
        options={BACKUP_REMINDER_OPTIONS.map((o) => ({
          label: o.label,
          selected: o.value === settings.backupReminder,
          onPress: () => void settings.update('backupReminder', o.value),
        }))}
      />
      <ReauthModal
        visible={reauth}
        reason={hasPassword ? 'change the backup password' : 'set a backup password'}
        onClose={() => setReauth(false)}
        onVerified={() => {
          setReauth(false);
          setPwError(null);
          setMode('password');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md + 2, paddingBottom: space.huge },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.field, borderWidth: 1 },
  radioGroup: { borderWidth: 1, borderRadius: radius.group, paddingHorizontal: space.lg },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
});

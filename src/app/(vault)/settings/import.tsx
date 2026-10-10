import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Banner, Monogram } from '@/components/ui/Layout';
import { ReauthModal } from '@/components/ReauthModal';
import { useCardStore } from '@/features/cards/store';
import { readBackupFile } from '@/features/import-export/backup-handler';
import { saveImport, type ImportOutcome } from '@/features/import-export/csv-handler';
import { parseImport, type ParsedImport } from '@/features/import-export/import-formats';
import { usePasswordStore } from '@/features/passwords/store';
import { useSettingsStore } from '@/features/settings/store';
import { radius, space, useTheme } from '@/theme';
import { runWithoutAutoLock } from '@/utils/auto-lock-guard';
import { cleanupTempFile } from '@/utils/cache';

const SOURCES = [
  { id: 'google', name: 'Google Password Manager', short: 'Google', steps: ['Open Google Password Manager › Settings.', 'Tap Export passwords and confirm.', 'Come back here and choose the downloaded file.'] },
  { id: 'bitwarden', name: 'Bitwarden', short: 'Bitwarden', steps: ['Open Bitwarden › Settings › Export vault.', 'Choose the .csv format.', 'Choose the file here.'] },
  { id: '1password', name: '1Password', short: '1Password', steps: ['On a computer, open 1Password › File › Export.', 'Choose CSV and move the file to this phone.', 'Choose the file here.'] },
  { id: 'lastpass', name: 'LastPass', short: 'LastPass', steps: ['Open LastPass › Advanced options › Export.', 'Save the CSV it creates.', 'Choose the file here.'] },
  { id: 'keepass', name: 'KeePass or KeePassXC', short: 'KeePass', steps: ['Open the database › Export › CSV file.', 'Move the file to this phone.', 'Choose the file here.'] },
  { id: 'other', name: 'Another CSV', short: 'CSV', steps: ['Any file with a header row works.', 'Columns are matched by name: title, url, username, email, password, notes.', 'You’ll see what was found before anything is saved.'] },
] as const;

const LIST_LIMIT = 50;

export default function ImportScreen() {
  const c = useTheme();
  const categories = useSettingsStore((s) => s.categories);
  const [source, setSource] = useState<string>('google');
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const chosen = SOURCES.find((s) => s.id === source) ?? SOURCES[0];

  const choose = async () => {
    setError(null);
    const doc = await runWithoutAutoLock(() =>
      DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true }),
    );
    if (doc.canceled) return;
    const asset = doc.assets[0];
    try {
      const text = await readBackupFile(asset.uri);
      const result = parseImport(text, categories);
      setFileName(asset.name);
      setParsed(result);
    } catch {
      setError('That file couldn’t be read as CSV.');
    } finally {
      // The export is plain text; don't keep our copy.
      cleanupTempFile(asset.uri);
    }
  };

  const doImport = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const result = await saveImport(parsed);
      await Promise.all([usePasswordStore.getState().load(), useCardStore.getState().load()]);
      setOutcome(result);
      setParsed(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nothing was imported.');
    } finally {
      setBusy(false);
    }
  };

  if (outcome) {
    const total = outcome.logins + outcome.cards;
    const title =
      total > 0
        ? `Imported ${[outcome.logins && `${outcome.logins} login${outcome.logins === 1 ? '' : 's'}`, outcome.cards && `${outcome.cards} card${outcome.cards === 1 ? '' : 's'}`]
            .filter(Boolean)
            .join(' and ')}`
        : outcome.duplicates > 0
          ? 'Nothing new to import'
          : 'Nothing was imported';
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.resultIcon, { backgroundColor: total > 0 ? c.successSoft : c.warnSoft }]}>
          <Icon name={total > 0 ? 'check' : 'info'} size={30} color={total > 0 ? c.success : c.warnText} />
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          {title}
        </AppText>
        <View style={{ gap: space.xs }}>
          {outcome.duplicates ? <AppText variant="body" tone="ink2">• {outcome.duplicates} already in your vault, skipped.</AppText> : null}
          {outcome.skipped ? <AppText variant="body" tone="ink2">• {outcome.skipped === 1 ? '1 note or other non-login item' : `${outcome.skipped} notes or other non-login items`} left out.</AppText> : null}
          {outcome.problems.length ? (
            <AppText variant="body" tone="ink2">
              • {outcome.problems.length} row{outcome.problems.length === 1 ? '' : 's'} couldn’t be imported:
            </AppText>
          ) : null}
        </View>
        {outcome.problems.slice(0, LIST_LIMIT).map((p, i) => (
          <AppText key={i} variant="caption" tone="danger">
            {p.row > 0 ? `Row ${p.row}: ` : ''}
            {p.message}
          </AppText>
        ))}
        {outcome.problems.length > LIST_LIMIT ? (
          <AppText variant="caption" tone="muted">
            …and {outcome.problems.length - LIST_LIMIT} more.
          </AppText>
        ) : null}
        <Banner tone="warn" title="Delete the exported file" body={`${fileName || 'The CSV'} isn’t encrypted. Remove it from Downloads and any cloud folder.`} />
        <Button label="Done" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  if (parsed) {
    const count = parsed.logins.length + parsed.cards.length;
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="headline" accessibilityRole="header">
          {count ? `Found ${count} item${count === 1 ? '' : 's'}` : 'Nothing to import'}
        </AppText>
        <AppText variant="body" tone="ink2">
          Read as a {parsed.formatLabel} file{fileName ? ` (${fileName})` : ''}. Nothing is saved until you confirm.
        </AppText>
        {parsed.skipped ? <AppText variant="caption" tone="muted">{parsed.skipped === 1 ? '1 note or other non-login item' : `${parsed.skipped} notes or other non-login items`} will be left out.</AppText> : null}
        {parsed.problems.length ? (
          <Banner
            tone="warn"
            title={`${parsed.problems.length} row${parsed.problems.length === 1 ? '' : 's'} can’t be imported`}
            body={parsed.problems
              .slice(0, 3)
              .map((p) => (p.row ? `Row ${p.row}: ${p.message}` : p.message))
              .join('\n')}
          />
        ) : null}
        <View style={[styles.preview, { backgroundColor: c.surface, borderColor: c.line }]}>
          {parsed.logins.slice(0, 8).map((l, i) => (
            <View key={i} style={[styles.previewRow, { borderBottomColor: c.divider }]}>
              <Monogram name={l.title} size={34} />
              <View style={{ flex: 1 }}>
                <AppText variant="label" numberOfLines={1}>
                  {l.title}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {l.username || l.email || l.website}
                </AppText>
              </View>
            </View>
          ))}
          {count > 8 ? (
            <AppText variant="caption" tone="muted" style={{ padding: space.md }}>
              …and {count - 8} more
            </AppText>
          ) : null}
        </View>
        {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
        {count ? <Button label={`Import ${count} item${count === 1 ? '' : 's'}`} onPress={() => setReauth(true)} loading={busy} /> : null}
        <Button label="Choose a different file" variant="quiet" onPress={() => setParsed(null)} />
        <ReauthModal
          visible={reauth}
          reason="import into your vault"
          onClose={() => setReauth(false)}
          onVerified={() => {
            setReauth(false);
            void doImport();
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        Where are they coming from?
      </AppText>
      <AppText variant="body" tone="ink2">
        The file is read on this phone, matched to the right fields, then wiped from the app’s cache.
      </AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel="Import source" style={[styles.sources, { backgroundColor: c.surface, borderColor: c.line }]}>
        {SOURCES.map((s, i) => {
          const on = s.id === source;
          return (
            <View key={s.id} style={i < SOURCES.length - 1 ? { borderBottomColor: c.line, borderBottomWidth: 1 } : undefined}>
              <Pressable onPress={() => setSource(s.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={styles.sourceRow}>
                <Monogram name={s.short} size={32} />
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {s.name}
                </AppText>
                <View style={[styles.radio, { borderColor: on ? c.brass : c.muted }]}>{on ? <View style={[styles.radioDot, { backgroundColor: c.brass }]} /> : null}</View>
              </Pressable>
              {on ? (
                <View style={[styles.steps, { backgroundColor: c.ground }]}>
                  {s.steps.map((step, n) => (
                    <AppText key={n} variant="caption" tone="ink2" style={{ fontSize: 14, fontWeight: '500' }}>
                      {n + 1}. {step}
                    </AppText>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <Banner tone="warn" title="Exported files aren’t encrypted" body="Delete it from Downloads once the import finishes." />
      {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
      <Button label={`Choose ${chosen.short} file`} icon="file" onPress={choose} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md + 2, paddingBottom: space.huge },
  sources: { borderWidth: 1, borderRadius: radius.group, paddingHorizontal: space.md + 2 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  steps: { borderRadius: 12, padding: space.md, gap: 6, marginBottom: space.md },
  preview: { borderWidth: 1, borderRadius: radius.group, overflow: 'hidden' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: 1 },
  resultIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});

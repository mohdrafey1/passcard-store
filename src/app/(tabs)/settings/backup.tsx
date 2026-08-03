import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { createBackup, shareBackup, restoreBackup } from '@/features/import-export/backup-handler';
import { usePasswordStore } from '@/features/passwords/store';
import { useCardStore } from '@/features/cards/store';
import { useSettingsStore } from '@/features/settings/store';
import { verifyStoredPin, getPinLength } from '@/security/pin';
import { cleanupTempFile } from '@/utils/cache';
import PinModal from '@/components/PinModal';

export default function BackupScreen() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'menu' | 'restore-pin'>('menu');
  const [restoreUri, setRestoreUri] = useState('');
  const [pin, setPin] = useState('');
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [createPinVisible, setCreatePinVisible] = useState(false);
  const [pinError, setPinError] = useState('');
  const loadPasswords = usePasswordStore((s) => s.load);
  const loadCards = useCardStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    getPinLength().then(setPinLength);
  }, []);

  const handleCreateBackup = () => {
    setPinError('');
    setCreatePinVisible(true);
  };

  const handleCreateWithPin = async (inputPin: string) => {
    const ok = await verifyStoredPin(inputPin);
    if (!ok) {
      setPinError('Incorrect PIN.');
      return;
    }
    setCreatePinVisible(false);
    setLoading(true);
    let fileUri: string | null = null;
    try {
      fileUri = await createBackup(inputPin);
      await shareBackup(fileUri);
      Alert.alert('Backup Created', 'Your encrypted backup was created. Keep it somewhere safe — you will need this same PIN to restore it.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Backup failed');
    } finally {
      // Remove the plaintext-on-disk backup file from cache once shared.
      if (fileUri) cleanupTempFile(fileUri);
      setLoading(false);
    }
  };

  const proceedWithRestore = (uri: string) => {
    setRestoreUri(uri);
    setPin('');
    setMode('restore-pin');
  };

  const handlePickRestore = async () => {
    try {
      // Accept ALL file types. `.vaultx` is a custom extension that Android
      // can't map to a MIME type, so any narrower filter (or the OS itself)
      // greys the file out in the picker. copyToCacheDirectory guarantees a
      // readable local URI regardless of which provider it came from.
      const doc = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (doc.canceled) return;
      const asset = doc.assets[0];
      const uri = asset.uri;
      const name = (asset.name || '').toLowerCase();

      // Do NOT hard-block on the extension: some providers return a display
      // name without ".vaultx". Validation happens for real when we try to
      // decrypt the file (it carries a magic header). If the name clearly
      // isn't a backup, just confirm before continuing.
      if (name && !name.endsWith('.vaultx')) {
        Alert.alert(
          'Use this file?',
          "This doesn't look like a .vaultx backup, but some file managers hide the extension. If this is your Passcard backup, continue.",
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => proceedWithRestore(uri) },
          ],
        );
        return;
      }
      proceedWithRestore(uri);
    } catch (e) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const doRestore = async () => {
    setLoading(true);
    try {
      const result = await restoreBackup(restoreUri, pin);
      await loadPasswords();
      await loadCards();
      await loadSettings();
      Alert.alert('Restored', `${result.passwords} passwords and ${result.cards} cards restored.`);
      setMode('menu');
      setPin('');
      router.back();
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message || 'Wrong PIN or corrupted backup');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    if (!pin || pin.length < 4) {
      Alert.alert('Error', 'Enter the PIN used to create the backup');
      return;
    }
    Alert.alert(
      'Replace all current data?',
      'Restoring will permanently REPLACE all passwords and cards currently in this vault with the contents of the backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: doRestore },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setMode('menu'); router.back(); }} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup & Restore</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        ) : mode === 'restore-pin' ? (
          <View style={styles.restoreContainer}>
            <Ionicons name="lock-open-outline" size={48} color={Colors.primary} />
            <Text style={styles.restoreTitle}>Enter Backup PIN</Text>
            <Text style={styles.restoreHint}>Enter the PIN used when creating this backup</Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              placeholder="Enter PIN"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              accessibilityLabel="Backup PIN"
            />
            <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} accessibilityRole="button">
              <Text style={styles.restoreButtonText}>Restore Backup</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.description}>
              Create encrypted backups of your data.{'\n'}
              Backups are protected with AES-256 encryption and your PIN.
            </Text>
            <TouchableOpacity style={styles.actionButton} onPress={handleCreateBackup} accessibilityRole="button" accessibilityLabel="Create backup">
              <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '15' }]}>
                <Ionicons name="cloud-upload-outline" size={28} color={Colors.primary} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Create Backup</Text>
                <Text style={styles.actionHint}>Encrypted .vaultx file with all your data</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handlePickRestore} accessibilityRole="button" accessibilityLabel="Restore backup">
              <View style={[styles.actionIcon, { backgroundColor: Colors.secondary + '15' }]}>
                <Ionicons name="cloud-download-outline" size={28} color={Colors.secondary} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Restore Backup</Text>
                <Text style={styles.actionHint}>Import from a .vaultx backup file (replaces current data)</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      <PinModal
        visible={createPinVisible}
        pinLength={pinLength}
        title="Confirm Your PIN"
        subtitle="Your backup will be encrypted with this PIN"
        error={pinError}
        onComplete={handleCreateWithPin}
        onClose={() => setCreatePinVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  headerTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  content: { flex: 1, padding: Spacing.base },
  description: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl, textAlign: 'center' },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  actionIcon: { width: 52, height: 52, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text },
  actionHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.base },
  loadingText: { fontSize: FontSize.base, color: Colors.textSecondary },
  restoreContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.base, paddingHorizontal: Spacing.xl },
  restoreTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  restoreHint: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  pinInput: { backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.lg, height: 56, fontSize: FontSize.xl, color: Colors.text, textAlign: 'center', letterSpacing: 8, width: '100%' },
  restoreButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing['3xl'], marginTop: Spacing.md },
  restoreButtonText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.white },
});

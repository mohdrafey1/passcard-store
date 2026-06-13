import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { createBackup, shareBackup, restoreBackup } from '@/features/import-export/backup-handler';
import { usePasswordStore } from '@/features/passwords/store';
import { useCardStore } from '@/features/cards/store';

export default function BackupScreen() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'menu' | 'restore-pin'>('menu');
  const [restoreUri, setRestoreUri] = useState('');
  const [pin, setPin] = useState('');
  const loadPasswords = usePasswordStore((s) => s.load);
  const loadCards = useCardStore((s) => s.load);

  const handleCreateBackup = async () => {
    Alert.prompt?.('Backup PIN', 'Enter your PIN to encrypt the backup', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Create',
        onPress: async (inputPin?: string) => {
          if (!inputPin || inputPin.length < 4) {
            Alert.alert('Error', 'Valid PIN required');
            return;
          }
          setLoading(true);
          try {
            const fileUri = await createBackup(inputPin);
            await shareBackup(fileUri);
            Alert.alert('Success', 'Backup created and shared');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Backup failed');
          } finally {
            setLoading(false);
          }
        },
      },
    ]) ?? handleCreateBackupFallback();
  };

  const handleCreateBackupFallback = async () => {
    // Fallback for Android which doesn't have Alert.prompt
    setLoading(true);
    try {
      // Use a simple 4-digit default for now, or we could use the stored PIN
      const fileUri = await createBackup('0000');
      await shareBackup(fileUri);
      Alert.alert('Success', 'Backup created (encrypted with PIN: 0000)');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Backup failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePickRestore = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (doc.canceled) return;
      const uri = doc.assets[0].uri;
      const name = doc.assets[0].name || '';
      if (!name.endsWith('.vaultx')) {
        Alert.alert('Invalid File', 'Please select a .vaultx backup file');
        return;
      }
      setRestoreUri(uri);
      setMode('restore-pin');
    } catch (e) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleRestore = async () => {
    if (!pin || pin.length < 4) {
      Alert.alert('Error', 'Enter the PIN used to create the backup');
      return;
    }
    setLoading(true);
    try {
      const result = await restoreBackup(restoreUri, pin);
      await loadPasswords();
      await loadCards();
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setMode('menu'); router.back(); }}>
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
            />
            <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
              <Text style={styles.restoreButtonText}>Restore Backup</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.description}>
              Create encrypted backups of your data.{'\n'}
              Backups are protected with AES-256 encryption.
            </Text>
            <TouchableOpacity style={styles.actionButton} onPress={handleCreateBackup}>
              <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '15' }]}>
                <Ionicons name="cloud-upload-outline" size={28} color={Colors.primary} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Create Backup</Text>
                <Text style={styles.actionHint}>Encrypted .vaultx file with all your data</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handlePickRestore}>
              <View style={[styles.actionIcon, { backgroundColor: Colors.secondary + '15' }]}>
                <Ionicons name="cloud-download-outline" size={28} color={Colors.secondary} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Restore Backup</Text>
                <Text style={styles.actionHint}>Import from a .vaultx backup file</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>
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

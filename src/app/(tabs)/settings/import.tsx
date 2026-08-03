import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { importPasswordsFromCSV, importCardsFromCSV, type ImportResult } from '@/features/import-export/csv-handler';
import { usePasswordStore } from '@/features/passwords/store';
import { useCardStore } from '@/features/cards/store';
import { verifyStoredPin, getPinLength } from '@/security/pin';
import { runWithoutAutoLock } from '@/hooks/useAutoLock';
import PinModal from '@/components/PinModal';

export default function ImportScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importType, setImportType] = useState<'passwords' | 'cards' | null>(null);
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [pinVisible, setPinVisible] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pendingType, setPendingType] = useState<'passwords' | 'cards' | null>(null);
  const loadPasswords = usePasswordStore((s) => s.load);
  const loadCards = useCardStore((s) => s.load);

  useEffect(() => {
    getPinLength().then(setPinLength);
  }, []);

  // Importing requires the PIN, so an unattended unlocked phone can't be used
  // to inject entries into the vault from a file.
  const handleImport = (type: 'passwords' | 'cards') => {
    setPendingType(type);
    setPinError('');
    setPinVisible(true);
  };

  const handlePinComplete = async (pin: string) => {
    const ok = await verifyStoredPin(pin);
    if (!ok) {
      setPinError('Incorrect PIN.');
      return;
    }
    setPinVisible(false);
    const type = pendingType;
    setPendingType(null);
    if (type) runImport(type);
  };

  const runImport = async (type: 'passwords' | 'cards') => {
    try {
      const doc = await runWithoutAutoLock(() =>
        DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', '*/*'] }),
      );
      if (doc.canceled) return;

      setLoading(true);
      setImportType(type);

      const fileUri = doc.assets[0].uri;
      const content = await new File(fileUri).text();

      let importResult: ImportResult;
      if (type === 'passwords') {
        importResult = await importPasswordsFromCSV(content);
        await loadPasswords();
      } else {
        importResult = await importCardsFromCSV(content);
        await loadCards();
      }

      setResult(importResult);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to import');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Data</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Importing {importType}...</Text>
          </View>
        ) : result ? (
          <View style={styles.resultContainer}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
            <Text style={styles.resultTitle}>Import Complete</Text>
            <View style={styles.resultGrid}>
              <ResultStat label="Imported" value={result.imported} color={Colors.success} />
              <ResultStat label="Skipped" value={result.skipped} color={Colors.warning} />
              <ResultStat label="Failed" value={result.failed} color={Colors.danger} />
            </View>
            {result.errors.length > 0 && (
              <Text style={styles.errorText}>{result.errors.slice(0, 3).join('\n')}</Text>
            )}
            <TouchableOpacity style={styles.doneButton} onPress={() => { setResult(null); router.back(); }}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.description}>
              Import passwords or cards from a CSV file.{'\n'}
              Make sure your CSV has the required column headers.
            </Text>
            <TouchableOpacity style={styles.importButton} onPress={() => handleImport('passwords')}>
              <Ionicons name="key-outline" size={24} color={Colors.primary} />
              <View style={styles.importButtonText}>
                <Text style={styles.importTitle}>Import Passwords</Text>
                <Text style={styles.importHint}>CSV with: title, email, password columns</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.importButton} onPress={() => handleImport('cards')}>
              <Ionicons name="card-outline" size={24} color={Colors.secondary} />
              <View style={styles.importButtonText}>
                <Text style={styles.importTitle}>Import Cards</Text>
                <Text style={styles.importHint}>CSV with: cardHolderName, cardNumber, etc.</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      <PinModal
        visible={pinVisible}
        pinLength={pinLength}
        title="Confirm Your PIN"
        subtitle="Enter your PIN to import data"
        error={pinError}
        onComplete={handlePinComplete}
        onClose={() => { setPinVisible(false); setPendingType(null); }}
      />
    </SafeAreaView>
  );
}

function ResultStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.resultStat}>
      <Text style={[styles.resultStatValue, { color }]}>{value}</Text>
      <Text style={styles.resultStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  headerTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  content: { flex: 1, padding: Spacing.base },
  description: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl, textAlign: 'center' },
  importButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  importButtonText: { flex: 1 },
  importTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text },
  importHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.base },
  loadingText: { fontSize: FontSize.base, color: Colors.textSecondary },
  resultContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  resultTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  resultGrid: { flexDirection: 'row', gap: Spacing.xl },
  resultStat: { alignItems: 'center' },
  resultStatValue: { fontSize: FontSize['2xl'], fontWeight: '700' },
  resultStatLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  errorText: { fontSize: FontSize.xs, color: Colors.danger, textAlign: 'center' },
  doneButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing['3xl'] },
  doneButtonText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.white },
});

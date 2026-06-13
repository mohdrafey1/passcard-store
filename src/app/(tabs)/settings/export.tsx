import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { exportPasswordsToCSV, exportCardsToCSV, exportAndShareCSV } from '@/features/import-export/csv-handler';
import { passwordRepository } from '@/storage/password-repository';
import { cardRepository } from '@/storage/card-repository';

export default function ExportScreen() {
  const [loading, setLoading] = useState(false);

  const handleExport = async (type: 'passwords' | 'cards' | 'all') => {
    setLoading(true);
    try {
      if (type === 'passwords' || type === 'all') {
        const passwords = await passwordRepository.findAll();
        if (passwords.length === 0 && type === 'passwords') {
          Alert.alert('No Data', 'No passwords to export');
          setLoading(false);
          return;
        }
        const csv = exportPasswordsToCSV(passwords);
        await exportAndShareCSV(csv, 'passwords-export.csv');
      }

      if (type === 'cards' || type === 'all') {
        const cards = await cardRepository.findAll();
        if (cards.length === 0 && type === 'cards') {
          Alert.alert('No Data', 'No cards to export');
          setLoading(false);
          return;
        }
        const csv = exportCardsToCSV(cards);
        await exportAndShareCSV(csv, 'cards-export.csv');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export Data</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Generating export...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.description}>
              Export your data as CSV files.{'\n'}
              Files will be shared via the native share sheet.
            </Text>
            <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('passwords')}>
              <Ionicons name="key-outline" size={24} color={Colors.primary} />
              <View style={styles.exportButtonText}>
                <Text style={styles.exportTitle}>Export Passwords</Text>
                <Text style={styles.exportHint}>All passwords as CSV</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('cards')}>
              <Ionicons name="card-outline" size={24} color={Colors.secondary} />
              <View style={styles.exportButtonText}>
                <Text style={styles.exportTitle}>Export Cards</Text>
                <Text style={styles.exportHint}>All cards as CSV</Text>
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
  exportButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  exportButtonText: { flex: 1 },
  exportTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text },
  exportHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.base },
  loadingText: { fontSize: FontSize.base, color: Colors.textSecondary },
});

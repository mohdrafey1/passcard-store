import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useSettingsStore } from '@/features/settings/store';
import { isBiometricAvailable, getBiometricType } from '@/security/biometrics';
import { changePin } from '@/security/pin';
import { deleteDatabase } from '@/storage/database';
import { deleteEncryptionKey } from '@/security/encryption';
import { deletePin } from '@/security/pin';
import { deleteAllSettings } from '@/storage/settings-storage';
import { AUTO_LOCK_OPTIONS, CLIPBOARD_CLEAR_OPTIONS } from '@/types/settings';
import type { AutoLockDuration, ClipboardClearDuration } from '@/types/settings';

function SettingRow({ icon, label, value, onPress, danger }: {
  icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settingIcon, danger && { backgroundColor: Colors.danger + '15' }]}>
        <Ionicons name={icon as any} size={20} color={danger ? Colors.danger : Colors.primary} />
      </View>
      <Text style={[styles.settingLabel, danger && { color: Colors.danger }]}>{label}</Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function SettingToggle({ icon, label, value, onToggle }: {
  icon: string; label: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const [biometricType, setBiometricType] = useState('Biometric');

  React.useEffect(() => {
    getBiometricType().then(setBiometricType);
  }, []);

  const handleBiometricsToggle = async (enabled: boolean) => {
    if (enabled) {
      const available = await isBiometricAvailable();
      if (!available) {
        Alert.alert('Not Available', 'Biometric authentication is not set up on this device.');
        return;
      }
    }
    await settings.setBiometrics(enabled);
  };

  const handleChangePin = () => {
    Alert.prompt?.('Change PIN', 'Enter new PIN (4 or 6 digits)', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change',
        onPress: async (pin?: string) => {
          if (pin && (pin.length === 4 || pin.length === 6) && /^\d+$/.test(pin)) {
            await changePin(pin);
            Alert.alert('Success', 'PIN changed successfully');
          } else {
            Alert.alert('Error', 'PIN must be 4 or 6 digits');
          }
        },
      },
    ]) ?? router.push('/(auth)/create-pin');
  };

  const handleAutoLock = () => {
    const options = AUTO_LOCK_OPTIONS.map((opt) => ({
      text: `${opt.label}${settings.autoLockDuration === opt.value ? ' ✓' : ''}`,
      onPress: () => settings.setAutoLockDuration(opt.value),
    }));
    options.push({ text: 'Cancel', onPress: async () => {} });
    Alert.alert('Auto Lock', 'Lock after going to background', options);
  };

  const handleClipboardClear = () => {
    const options = CLIPBOARD_CLEAR_OPTIONS.map((opt) => ({
      text: `${opt.label}${settings.clipboardClearDuration === opt.value ? ' ✓' : ''}`,
      onPress: () => settings.setClipboardClearDuration(opt.value),
    }));
    options.push({ text: 'Cancel', onPress: async () => {} });
    Alert.alert('Clipboard Clear', 'Clear clipboard after copying', options);
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all passwords, cards, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDatabase();
              await deleteEncryptionKey();
              await deletePin();
              await deleteAllSettings();
              await settings.resetAll();
              router.replace('/');
            } catch (e) {
              Alert.alert('Error', 'Failed to delete data');
            }
          },
        },
      ],
    );
  };

  const autoLockLabel = AUTO_LOCK_OPTIONS.find((o) => o.value === settings.autoLockDuration)?.label || 'Immediate';
  const clipboardLabel = CLIPBOARD_CLEAR_OPTIONS.find((o) => o.value === settings.clipboardClearDuration)?.label || '30 seconds';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Settings</Text>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.section}>
          <SettingRow icon="key-outline" label="Change PIN" onPress={handleChangePin} />
          <SettingToggle icon="finger-print" label={`${biometricType} Unlock`} value={settings.biometricsEnabled} onToggle={handleBiometricsToggle} />
          <SettingRow icon="time-outline" label="Auto Lock" value={autoLockLabel} onPress={handleAutoLock} />
          <SettingRow icon="clipboard-outline" label="Clipboard Clear" value={clipboardLabel} onPress={handleClipboardClear} />
        </View>

        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.section}>
          <SettingRow icon="download-outline" label="Import Data" onPress={() => router.push('/(tabs)/settings/import')} />
          <SettingRow icon="share-outline" label="Export Data" onPress={() => router.push('/(tabs)/settings/export')} />
          <SettingRow icon="archive-outline" label="Create Backup" onPress={() => router.push('/(tabs)/settings/backup')} />
        </View>

        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <View style={styles.section}>
          <SettingRow icon="trash-outline" label="Delete All Data" onPress={handleDeleteAll} danger />
        </View>

        <Text style={styles.version}>Passcard Store v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  settingIcon: { width: 36, height: 36, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  settingLabel: { flex: 1, fontSize: FontSize.base, color: Colors.text, fontWeight: '500' },
  settingValue: { fontSize: FontSize.sm, color: Colors.textSecondary, marginRight: Spacing.sm },
  version: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.sm, marginTop: Spacing['2xl'] },
});

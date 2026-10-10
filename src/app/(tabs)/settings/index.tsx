import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useSettingsStore } from '@/features/settings/store';
import { getBiometricLabel } from '@/security/biometrics';
import { eraseVault, lockVault } from '@/features/session/session';
import ActionSheet, { type SheetAction } from '@/components/ActionSheet';
import PinModal from '@/components/PinModal';
import { AUTO_LOCK_OPTIONS, CLIPBOARD_CLEAR_OPTIONS } from '@/types/settings';

function SettingRow({ icon, label, value, onPress, danger }: {
  icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
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
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const [biometricType, setBiometricType] = useState('Biometric');
  const [picker, setPicker] = useState<'autolock' | 'clipboard' | null>(null);
  const [deleteAuthVisible, setDeleteAuthVisible] = useState(false);

  useEffect(() => {
    getBiometricLabel().then(setBiometricType);
  }, []);

  const handleBiometricsToggle = async (enabled: boolean) => {
    if (enabled && !settings.biometricsAvailable) {
      Alert.alert('Not available', 'Add a fingerprint in your phone\u2019s settings first.');
      return;
    }
    try {
      await settings.setBiometrics(enabled);
    } catch {
      // Cancelled at the system prompt; nothing changed.
    }
  };

  // ---- Pickers (replaces multi-button Alert menus that break on Android) ----
  const autoLockActions: SheetAction[] = AUTO_LOCK_OPTIONS.map((opt) => ({
    label: opt.label,
    icon: settings.autoLockDuration === opt.value ? 'checkmark-circle' : 'ellipse-outline',
    onPress: () => settings.update('autoLockDuration', opt.value),
  }));

  const clipboardActions: SheetAction[] = CLIPBOARD_CLEAR_OPTIONS.map((opt) => ({
    label: opt.label,
    icon: settings.clipboardClearDuration === opt.value ? 'checkmark-circle' : 'ellipse-outline',
    onPress: () => settings.update('clipboardClearDuration', opt.value),
  }));

  // ---- Delete all (requires PIN re-authentication) ----
  const performWipe = async () => {
    try {
      await eraseVault();
      router.replace('/');
    } catch {
      Alert.alert('Error', 'Failed to delete data');
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all passwords, cards, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeleteAuthVisible(true);
          },
        },
      ],
    );
  };

  const handleDeleteAuth = async () => {
    setDeleteAuthVisible(false);
    await performWipe();
  };

  const autoLockLabel = AUTO_LOCK_OPTIONS.find((o) => o.value === settings.autoLockDuration)?.label || 'Immediate';
  const clipboardLabel = CLIPBOARD_CLEAR_OPTIONS.find((o) => o.value === settings.clipboardClearDuration)?.label || '30 seconds';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Settings</Text>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.section}>
          <SettingRow icon="key-outline" label="Change PIN" onPress={() => router.push('/(tabs)/settings/change-pin')} />
          <SettingToggle icon="finger-print" label={`${biometricType} Unlock`} value={settings.biometricsEnabled} onToggle={handleBiometricsToggle} />
          <SettingRow icon="time-outline" label="Auto Lock" value={autoLockLabel} onPress={() => setPicker('autolock')} />
          <SettingRow icon="clipboard-outline" label="Clipboard Clear" value={clipboardLabel} onPress={() => setPicker('clipboard')} />
          <SettingToggle icon="warning-outline" label="Erase after 10 wrong PINs" value={settings.wipeAfterFailures} onToggle={(v) => settings.update('wipeAfterFailures', v)} />
          <SettingRow icon="lock-closed-outline" label="Lock now" onPress={lockVault} />
        </View>

        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.section}>
          <SettingRow icon="download-outline" label="Import Data" onPress={() => router.push('/(tabs)/settings/import')} />
          <SettingRow icon="share-outline" label="Export Data" onPress={() => router.push('/(tabs)/settings/export')} />
          <SettingRow icon="archive-outline" label="Backup & Restore" onPress={() => router.push('/(tabs)/settings/backup')} />
        </View>

        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <View style={styles.section}>
          <SettingRow icon="trash-outline" label="Delete All Data" onPress={handleDeleteAll} danger />
        </View>

        <Text style={styles.version}>Passcard Store v{appVersion}</Text>
      </ScrollView>

      <ActionSheet
        visible={picker === 'autolock'}
        onClose={() => setPicker(null)}
        title="Auto Lock"
        subtitle="Lock after going to background"
        actions={autoLockActions}
      />
      <ActionSheet
        visible={picker === 'clipboard'}
        onClose={() => setPicker(null)}
        title="Clipboard Clear"
        subtitle="Clear clipboard after copying"
        actions={clipboardActions}
      />

      <PinModal
        visible={deleteAuthVisible}
        title="Confirm it's you"
        subtitle="Enter your PIN to erase the vault"
        onVerified={handleDeleteAuth}
        onClose={() => setDeleteAuthVisible(false)}
      />
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

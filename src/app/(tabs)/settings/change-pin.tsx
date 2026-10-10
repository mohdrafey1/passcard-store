import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PinPad from '@/components/PinPad';
import { changeSecret } from '@/security/key-manager';
import { weakPinReason } from '@/security/pin-rules';
import { verifyWithLockout } from '@/features/session/session';
import { useSettingsStore } from '@/features/settings/store';
import { Colors, FontSize, Spacing } from '@/constants/theme';

type Step = 'current' | 'new' | 'confirm';

export default function ChangePinScreen() {
  const [step, setStep] = useState<Step>('current');
  const pinLength = useSettingsStore((s) => s.pinLength) ?? 6;
  const refreshSecurity = useSettingsStore((s) => s.refreshSecurity);
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');

  const handleCurrent = async (pin: string) => {
    const result = await verifyWithLockout(pin, 'PIN');
    if (result.ok) {
      setError('');
      setStep('new');
    } else if (result.erased) {
      router.replace('/');
    } else {
      setError(result.message);
    }
  };

  const handleNew = (pin: string) => {
    const weak = weakPinReason(pin);
    if (weak) {
      setError(`${weak} Choose another PIN.`);
      return;
    }
    setNewPin(pin);
    setError('');
    setStep('confirm');
  };

  const handleConfirm = async (pin: string) => {
    if (pin !== newPin) {
      setError('PINs do not match. Try again.');
      setNewPin('');
      setStep('new');
      return;
    }
    try {
      // One atomic write replaces the key slot; the old PIN stops working.
      await changeSecret(pin, 'pin', pinLength);
      await refreshSecurity();
      Alert.alert('Success', 'Your PIN has been changed.');
      router.back();
    } catch {
      setError('Failed to change PIN. Please try again.');
      setNewPin('');
      setStep('new');
    }
  };

  const config = {
    current: {
      title: 'Enter Current PIN',
      subtitle: 'Verify your current PIN to continue',
      onComplete: handleCurrent,
    },
    new: {
      title: 'Enter New PIN',
      subtitle: `Choose a new ${pinLength}-digit PIN`,
      onComplete: handleNew,
    },
    confirm: {
      title: 'Confirm New PIN',
      subtitle: 'Re-enter your new PIN to confirm',
      onComplete: handleConfirm,
    },
  }[step];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change PIN</Text>
        <View style={{ width: 32 }} />
      </View>
      <PinPad
        key={step}
        pinLength={pinLength}
        onComplete={config.onComplete}
        title={config.title}
        subtitle={config.subtitle}
        error={error}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
});

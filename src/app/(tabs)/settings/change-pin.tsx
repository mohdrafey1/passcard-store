import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PinPad from '@/components/PinPad';
import { verifyStoredPin, getPinLength, changePin } from '@/security/pin';
import { rewrapForNewPin } from '@/security/key-manager';
import { Colors, FontSize, Spacing } from '@/constants/theme';

type Step = 'current' | 'new' | 'confirm';

export default function ChangePinScreen() {
  const [step, setStep] = useState<Step>('current');
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getPinLength().then(setPinLength);
  }, []);

  const handleCurrent = async (pin: string) => {
    const ok = await verifyStoredPin(pin);
    if (ok) {
      setError('');
      setStep('new');
    } else {
      setError('Incorrect current PIN.');
    }
  };

  const handleNew = (pin: string) => {
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
      // Update the stored PIN hash and re-wrap the data key under the new PIN.
      await changePin(pin);
      await rewrapForNewPin(pin);
      Alert.alert('Success', 'Your PIN has been changed.');
      router.back();
    } catch {
      setError('Failed to change PIN. Please try again.');
      setNewPin('');
      setStep('current');
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

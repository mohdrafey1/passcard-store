import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import PinPad from '@/components/PinPad';
import { createPin } from '@/security/pin';
import { provisionKeyForNewPin } from '@/security/key-manager';
import { useSettingsStore } from '@/features/settings/store';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CreatePinScreen() {
  const [step, setStep] = useState<'select' | 'create' | 'confirm'>('select');
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const initialize = useSettingsStore((s) => s.initialize);
  const setAuthenticated = useSettingsStore((s) => s.setAuthenticated);

  const handleSelectLength = (length: 4 | 6) => {
    setPinLength(length);
    setStep('create');
  };

  const handleCreatePin = (pin: string) => {
    setFirstPin(pin);
    setError('');
    setStep('confirm');
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin !== firstPin) {
      setError('PINs do not match. Try again.');
      setStep('create');
      setFirstPin('');
      return;
    }

    setCreating(true);
    try {
      await createPin(pin);
      // Provision the data key wrapped under this PIN and open the session, so
      // the user goes straight into the app instead of re-entering the PIN.
      await provisionKeyForNewPin(pin);
      await initialize();
      setAuthenticated(true);
      router.replace('/(tabs)');
    } catch (e) {
      setError('Failed to create PIN. Please try again.');
      setStep('create');
      setFirstPin('');
    } finally {
      setCreating(false);
    }
  };

  if (step === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.selectContainer}>
          <View style={styles.logoContainer}>
            <Ionicons name="shield-checkmark" size={64} color={Colors.primary} />
          </View>
          <Text style={styles.welcomeTitle}>Welcome to Passcard Store</Text>
          <Text style={styles.welcomeSubtitle}>
            Your secure offline vault for passwords and cards.{'\n'}
            Choose a PIN length to get started.
          </Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.option}
              onPress={() => handleSelectLength(4)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionDigit}>4</Text>
              <Text style={styles.optionLabel}>Digit PIN</Text>
              <Text style={styles.optionHint}>Quick access</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, styles.optionRecommended]}
              onPress={() => handleSelectLength(6)}
              activeOpacity={0.7}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>RECOMMENDED</Text>
              </View>
              <Text style={styles.optionDigit}>6</Text>
              <Text style={styles.optionLabel}>Digit PIN</Text>
              <Text style={styles.optionHint}>More secure</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PinPad
        pinLength={pinLength}
        onComplete={step === 'create' ? handleCreatePin : handleConfirmPin}
        title={step === 'create' ? 'Create Your PIN' : 'Confirm Your PIN'}
        subtitle={
          step === 'create'
            ? `Enter a ${pinLength}-digit PIN`
            : 'Re-enter your PIN to confirm'
        }
        error={error}
      />
      {creating && (
        <View style={styles.creatingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.creatingText}>Setting up your vault…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  creatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246, 242, 235, 0.7)',
    gap: Spacing.md,
  },
  creatingText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  selectContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  welcomeTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  welcomeSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing['3xl'],
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: Spacing.base,
    width: '100%',
  },
  option: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionRecommended: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  badge: {
    position: 'absolute',
    top: -10,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  optionDigit: {
    fontSize: FontSize['3xl'],
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  optionLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },
  optionHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});

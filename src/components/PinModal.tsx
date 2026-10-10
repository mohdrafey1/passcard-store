import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PinPad from '@/components/PinPad';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useSettingsStore } from '@/features/settings/store';
import { currentLockoutMessage, verifyWithLockout } from '@/features/session/session';

interface PinModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Called once the PIN/passphrase is confirmed. */
  onVerified: () => void;
  onClose: () => void;
}

/**
 * Re-authentication before a sensitive action (export, backup password,
 * erase). Verifies through the shared lockout, so wrong attempts here count
 * the same as on the unlock screen.
 */
export default function PinModal({ visible, title, subtitle, onVerified, onClose }: PinModalProps) {
  const method = useSettingsStore((s) => s.unlockMethod);
  const pinLength = useSettingsStore((s) => s.pinLength) ?? 6;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const noun = method === 'pin' ? 'PIN' : 'passphrase';

  useEffect(() => {
    if (visible) {
      setError(currentLockoutMessage() ?? '');
      setPassphrase('');
    }
  }, [visible]);

  const submit = async (secret: string) => {
    if (busy || !secret) return;
    setBusy(true);
    try {
      const result = await verifyWithLockout(secret, noun);
      if (result.ok) {
        setError('');
        onVerified();
      } else if (result.erased) {
        onClose();
        router.replace('/');
      } else {
        setError(result.message);
      }
    } finally {
      setBusy(false);
      setPassphrase('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={26} color={Colors.text} />
          </TouchableOpacity>
        </View>
        {method === 'pin' ? (
          <PinPad
            pinLength={pinLength}
            onComplete={submit}
            title={title}
            subtitle={subtitle ?? `Enter your ${noun} to continue`}
            error={error}
          />
        ) : (
          <View style={styles.passphrase}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle ?? 'Enter your passphrase to continue'}</Text>
            <TextInput
              style={styles.input}
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Passphrase"
              onSubmitEditing={() => submit(passphrase)}
              returnKeyType="done"
            />
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => submit(passphrase)}
              accessibilityRole="button"
              disabled={busy}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}
        {busy && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  closeButton: { padding: Spacing.sm },
  passphrase: { flex: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center', gap: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  error: { minHeight: 20, color: Colors.danger, fontSize: FontSize.sm, textAlign: 'center' },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: Colors.white, fontSize: FontSize.base, fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
});

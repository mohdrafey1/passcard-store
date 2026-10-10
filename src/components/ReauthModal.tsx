import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { PinPad } from '@/components/ui/PinPad';
import { currentLockoutMessage, verifyWithLockout } from '@/features/session/session';
import { useSettingsStore } from '@/features/settings/store';
import { space, useTheme } from '@/theme';

interface ReauthModalProps {
  visible: boolean;
  /** What the check is for, e.g. "Export as CSV". */
  reason: string;
  onVerified: () => void;
  onClose: () => void;
}

/**
 * Confirm it's the owner before a sensitive action. Uses the shared lockout,
 * so wrong attempts here count the same as on the unlock screen.
 */
export function ReauthModal({ visible, reason, onVerified, onClose }: ReauthModalProps) {
  const c = useTheme();
  const method = useSettingsStore((s) => s.unlockMethod);
  const pinLength = useSettingsStore((s) => s.pinLength) ?? 6;
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [wasVisible, setWasVisible] = useState(false);
  const noun = method === 'pin' ? 'PIN' : 'passphrase';

  // Start each opening fresh, showing any lockout that's still running.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setError(currentLockoutMessage() ?? undefined);
      setPassphrase('');
    }
  }

  const submit = async (secret: string) => {
    if (busy || !secret) return;
    setBusy(true);
    try {
      const result = await verifyWithLockout(secret, noun);
      if (result.ok) {
        setError(undefined);
        onVerified();
      } else if (result.erased) {
        onClose();
      } else {
        setError(result.message);
      }
    } finally {
      setBusy(false);
      setPassphrase('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaView style={[styles.container, { backgroundColor: c.ground }]}>
        <View style={styles.header}>
          <IconButton icon="x" label="Cancel" onPress={onClose} />
        </View>
        {method === 'pin' ? (
          <PinPad
            length={pinLength}
            onComplete={submit}
            title="Confirm it's you"
            subtitle={`Enter your PIN to continue: ${reason}`}
            error={error}
            disabled={busy}
          />
        ) : (
          <View style={styles.passphrase}>
            <AppText variant="title" align="center" accessibilityRole="header">
              Confirm it’s you
            </AppText>
            <AppText variant="body" tone="ink2" align="center">
              Enter your passphrase to continue: {reason}
            </AppText>
            <Field
              label="Passphrase"
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => submit(passphrase)}
              returnKeyType="done"
              error={error}
            />
            <Button label="Continue" onPress={() => submit(passphrase)} loading={busy} />
          </View>
        )}
        {busy && method === 'pin' ? <ActivityIndicator style={styles.spinner} color={c.brass} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: space.sm, paddingTop: space.sm },
  passphrase: { flex: 1, paddingHorizontal: space.xxl, justifyContent: 'center', gap: space.lg },
  spinner: { position: 'absolute', bottom: space.huge, alignSelf: 'center' },
});

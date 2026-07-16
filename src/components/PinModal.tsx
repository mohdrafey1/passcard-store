import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PinPad from '@/components/PinPad';
import { Colors, Spacing } from '@/constants/theme';

interface PinModalProps {
  visible: boolean;
  pinLength: 4 | 6;
  title: string;
  subtitle?: string;
  error?: string;
  onComplete: (pin: string) => void;
  onClose: () => void;
}

/**
 * Full-screen PIN entry used to re-authenticate before sensitive actions
 * (delete everything, create backup). The parent decides how to validate the
 * entered PIN and passes back an `error` string to display on a mismatch.
 */
export default function PinModal({
  visible,
  pinLength,
  title,
  subtitle,
  error,
  onComplete,
  onClose,
}: PinModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
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
        <PinPad
          pinLength={pinLength}
          onComplete={onComplete}
          title={title}
          subtitle={subtitle}
          error={error}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  closeButton: { padding: Spacing.xs },
});

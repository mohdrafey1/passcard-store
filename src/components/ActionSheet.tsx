import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';

export interface SheetAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  actions: SheetAction[];
}

export default function ActionSheet({ visible, onClose, title, subtitle, actions }: ActionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.flex}>
        {/* Tap anywhere outside the sheet to close */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, Shadow.lg]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
          {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}

          <View style={styles.actions}>
            {actions.map((action, i) => (
              <TouchableOpacity
                key={`${action.label}-${i}`}
                style={styles.actionRow}
                activeOpacity={0.6}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
              >
                <View style={[styles.iconCircle, action.destructive && styles.iconCircleDanger]}>
                  <Ionicons
                    name={action.icon}
                    size={20}
                    color={action.destructive ? Colors.danger : Colors.primary}
                  />
                </View>
                <Text style={[styles.actionLabel, action.destructive && styles.actionLabelDanger]}>
                  {action.label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['2xl'],
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  actions: {
    marginTop: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleDanger: {
    backgroundColor: Colors.danger + '15',
  },
  actionLabel: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },
  actionLabelDanger: {
    color: Colors.danger,
  },
  cancelButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});

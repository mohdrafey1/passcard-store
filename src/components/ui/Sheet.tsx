import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface SheetOption {
  label: string;
  detail?: string;
  icon?: IconName;
  selected?: boolean;
  destructive?: boolean;
  onPress: () => void;
}

interface SheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  options: SheetOption[];
  onClose: () => void;
  /** Show radio marks (single choice) instead of chevrons. */
  choice?: boolean;
}

/** Bottom action sheet / single-choice picker. */
export function Sheet({ visible, title, subtitle, options, onClose, choice }: SheetProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.handle, { backgroundColor: c.dotEmpty }]} />
        {title ? (
          <View style={styles.header}>
            <AppText variant="headline" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" tone="muted">
                {subtitle}
              </AppText>
            ) : null}
          </View>
        ) : null}
        <ScrollView style={{ maxHeight: 420 }} bounces={false}>
          {options.map((o) => (
            <Pressable
              key={o.label}
              onPress={() => {
                onClose();
                o.onPress();
              }}
              accessibilityRole={choice ? 'radio' : 'button'}
              accessibilityState={choice ? { checked: !!o.selected } : undefined}
              accessibilityLabel={[o.label, o.detail].filter(Boolean).join(', ')}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: c.raised }]}
            >
              {o.icon ? (
                <View style={[styles.optionIcon, { backgroundColor: o.destructive ? c.dangerSoft : c.raised }]}>
                  <Icon name={o.icon} size={18} color={o.destructive ? c.danger : c.ink2} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ fontWeight: '600', color: o.destructive ? c.danger : c.ink }}>
                  {o.label}
                </AppText>
                {o.detail ? (
                  <AppText variant="caption" tone="muted">
                    {o.detail}
                  </AppText>
                ) : null}
              </View>
              {choice ? (
                <View style={[styles.radio, { borderColor: o.selected ? c.brass : c.muted }]}>
                  {o.selected ? <View style={[styles.radioDot, { backgroundColor: c.brass }]} /> : null}
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: space.sm + 2,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.md },
  header: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.xl, paddingVertical: space.sm },
  optionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
});

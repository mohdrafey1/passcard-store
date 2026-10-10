import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';

// ---- Switch ----

export function Toggle({
  value,
  onValueChange,
  label,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ false: c.line, true: c.brass }}
      thumbColor={value ? c.onBrass : c.muted}
      ios_backgroundColor={c.line}
    />
  );
}

// ---- Filter chips ----

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  label,
  inset = 0,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** Let the row scroll to the screen edges past this much container padding. */
  inset?: number;
}) {
  const c = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={inset ? { marginHorizontal: -inset } : undefined}
      contentContainerStyle={[styles.chipRow, inset ? { paddingHorizontal: inset } : null]}
      accessibilityLabel={label}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[
              styles.chip,
              on
                ? { backgroundColor: c.brass, borderColor: c.brass }
                : { backgroundColor: c.surface, borderColor: c.line },
            ]}
          >
            <AppText variant="label" style={{ color: on ? c.onBrass : c.ink2 }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---- Segmented control ----

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  style,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: c.ground, borderColor: c.line }, style]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segment, on && { backgroundColor: c.raised }]}
          >
            <AppText variant="label" style={{ color: on ? c.ink : c.muted }} numberOfLines={1}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- Badge ----

export function Badge({ label, tone = 'brass' }: { label: string; tone?: 'brass' | 'warn' | 'danger' | 'success' | 'muted' }) {
  const c = useTheme();
  const colors = {
    brass: { bg: 'transparent', fg: c.brassText, border: c.brassText },
    warn: { bg: c.warnSoft, fg: c.warnText, border: c.warnSoft },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft },
    success: { bg: c.successSoft, fg: c.success, border: c.successSoft },
    muted: { bg: c.raised, fg: c.ink2, border: c.raised },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <AppText variant="small" style={{ color: colors.fg }}>
        {label}
      </AppText>
    </View>
  );
}

// ---- Strength meter ----

export function StrengthMeter({ score, label, detail }: { score: 0 | 1 | 2 | 3 | 4; label: string; detail?: string }) {
  const c = useTheme();
  const color = [c.danger, c.danger, c.warn, c.success, c.success][score];
  return (
    <View
      style={styles.meter}
      accessible
      accessibilityLabel={`Strength: ${label}${detail ? `, ${detail}` : ''}`}
    >
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i <= score ? color : c.line }]} />
        ))}
      </View>
      <AppText variant="caption" style={{ color, fontWeight: '700' }}>
        {label}
      </AppText>
      {detail ? (
        <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
          · {detail}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { gap: space.sm, paddingRight: space.lg },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.lg - 2,
    borderRadius: radius.chip,
    borderWidth: 1,
    justifyContent: 'center',
  },
  segmented: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'center' },
  meter: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 24 },
  bars: { flexDirection: 'row', gap: 3, width: 72 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});

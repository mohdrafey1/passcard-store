import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { monogramColors, monogramLetter, radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

// ---- Screen ----

export function Screen({ children, edges = ['top'], style }: { children: React.ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: c.ground }, style]}>
      {children}
    </SafeAreaView>
  );
}

// ---- Grouped section ----

export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText variant="overline" tone="muted" accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </AppText>
  );
}

export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }, style]}>
      {items.map((child, i) => (
        <View key={i} style={i < items.length - 1 ? [styles.divided, { borderBottomColor: c.line }] : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

interface RowProps {
  label: string;
  icon?: IconName;
  value?: string;
  detail?: string;
  onPress?: () => void;
  accessory?: React.ReactNode;
  tone?: 'default' | 'brass' | 'danger' | 'warn';
  chevron?: boolean;
  badge?: React.ReactNode;
}

/** Settings-style row: icon tile, label (+ detail), value, chevron or accessory. */
export function Row({ label, icon, value, detail, onPress, accessory, tone = 'default', chevron = !!onPress, badge }: RowProps) {
  const c = useTheme();
  const labelColor = tone === 'danger' ? c.danger : tone === 'brass' ? c.brassText : c.ink;
  const valueColor = tone === 'warn' ? c.warnText : c.muted;
  const tileBg = tone === 'brass' ? c.brassSoft : tone === 'danger' ? c.dangerSoft : c.raised;
  const tileFg = tone === 'brass' ? c.brassText : tone === 'danger' ? c.danger : c.ink2;
  const content = (
    <View style={styles.row}>
      {icon && (
        <View style={[styles.tile, { backgroundColor: tileBg }]}>
          <Icon name={icon} size={18} color={tileFg} />
        </View>
      )}
      <View style={styles.rowText}>
        <View style={styles.labelLine}>
          <AppText variant="body" style={{ color: labelColor, fontWeight: tone === 'brass' ? '800' : '600', flexShrink: 1 }}>
            {label}
          </AppText>
          {badge}
        </View>
        {detail ? (
          <AppText variant="caption" tone="muted">
            {detail}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText
          variant="caption"
          style={{ color: valueColor, maxWidth: '45%', fontWeight: tone === 'warn' ? '700' : '600' }}
          numberOfLines={1}
        >
          {value}
        </AppText>
      ) : null}
      {accessory}
      {chevron && <Icon name="chevron-right" size={18} color={c.muted} />}
    </View>
  );
  if (!onPress)
    return (
      <View accessible={!accessory} accessibilityLabel={value ? `${label}, ${value}` : label}>
        {content}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[label, value, detail].filter(Boolean).join(', ')}
      style={({ pressed }) => ({ backgroundColor: pressed ? c.raised : 'transparent' })}
    >
      {content}
    </Pressable>
  );
}

// ---- Detail row (label above value, actions on the right) ----

export function DetailRow({
  label,
  value,
  mono,
  muted,
  children,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  /** Action buttons (copy, reveal). */
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailText} accessible accessibilityLabel={`${label}: ${value}`}>
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
        <AppText
          variant={mono ? 'mono' : 'body'}
          tone={muted ? 'muted' : 'ink'}
          style={{ fontWeight: mono ? '500' : '600' }}
          selectable={false}
        >
          {value}
        </AppText>
      </View>
      {children}
    </View>
  );
}

// ---- Banner ----

export function Banner({
  tone = 'warn',
  icon = 'alert-triangle',
  title,
  body,
  action,
  onPress,
}: {
  tone?: 'warn' | 'danger' | 'info';
  icon?: IconName;
  title: string;
  body?: string;
  action?: string;
  onPress?: () => void;
}) {
  const c = useTheme();
  const colors = {
    warn: { bg: c.warnSoft, line: c.warnLine, fg: c.warnText, ink: c.warnInk },
    danger: { bg: c.dangerSoft, line: c.dangerLine, fg: c.danger, ink: c.ink },
    info: { bg: c.surface, line: c.line, fg: c.brassText, ink: c.ink2 },
  }[tone];
  const inner = (
    <View style={[styles.banner, { backgroundColor: colors.bg, borderColor: colors.line }]}>
      <Icon name={icon} size={20} color={colors.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" style={{ color: tone === 'info' ? c.ink : c.ink }}>
          {title}
        </AppText>
        {body ? (
          <AppText variant="caption" style={{ color: colors.ink, fontWeight: '500' }}>
            {body}
          </AppText>
        ) : null}
      </View>
      {action ? (
        <AppText variant="label" style={{ color: colors.fg, fontWeight: '800' }}>
          {action}
        </AppText>
      ) : null}
    </View>
  );
  if (!onPress)
    return (
      <View accessible accessibilityRole="text">
        {inner}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, body, action]
        .filter(Boolean)
        .map((part) => String(part).replace(/[.\s]+$/, ''))
        .join('. ')}
    >
      {inner}
    </Pressable>
  );
}

// ---- Monogram tile ----

export function Monogram({ name, size = 42 }: { name: string; size?: number }) {
  const c = useTheme();
  const [bg, fg] = monogramColors(name, c);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size * 0.29, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <AppText
        variant="headline"
        style={{ color: fg, fontSize: size * 0.43, lineHeight: size * 0.55, fontWeight: '800' }}
        maxFontSizeMultiplier={1.2}
      >
        {monogramLetter(name)}
      </AppText>
    </View>
  );
}

// ---- Empty state ----

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children?: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Icon name={icon} size={32} color={c.brassText} />
      </View>
      <AppText variant="headline" align="center">
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" tone="ink2" align="center">
          {body}
        </AppText>
      ) : null}
      {children ? <View style={styles.emptyActions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: space.xxl, marginBottom: space.sm, marginHorizontal: space.xs },
  group: { borderRadius: radius.group, borderWidth: 1, paddingHorizontal: space.md + 2, overflow: 'hidden' },
  divided: { borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  labelLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.sm, minHeight: 64 },
  detailText: { flex: 1, minWidth: 0, gap: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2, borderRadius: radius.field, borderWidth: 1 },
  empty: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingVertical: space.huge },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyActions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.md },
});

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';

interface ToastState {
  id: number;
  title: string;
  /** Right-aligned note, e.g. "clears in 30s". */
  note?: string;
  action?: { label: string; onPress: () => void };
  durationMs: number;
}

interface ToastStore {
  toast: ToastState | null;
  show: (t: Omit<ToastState, 'id' | 'durationMs'> & { durationMs?: number }) => void;
  hide: () => void;
}

let nextId = 1;

export const useToast = create<ToastStore>((set) => ({
  toast: null,
  show: (t) => set({ toast: { durationMs: t.action ? 5000 : 2800, ...t, id: nextId++ } }),
  hide: () => set({ toast: null }),
}));

export function showToast(title: string, note?: string): void {
  useToast.getState().show({ title, note });
}

/**
 * One toast at a time, above the tab bar. A thin bar shows how long it stays.
 * Announced politely to screen readers.
 */
export function ToastHost({ bottomOffset = 88 }: { bottomOffset?: number }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!toast) return;
    progress.value = 1;
    progress.value = withTiming(0, { duration: toast.durationMs, easing: Easing.linear });
    const timer = setTimeout(hide, toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast, hide, progress]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.duration(160)}
      exiting={FadeOutDown.duration(140)}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + bottomOffset }]}
    >
      <View style={[styles.toast, { backgroundColor: c.toastBg }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <View style={styles.line}>
          <AppText variant="label" style={{ color: c.toastInk, flex: 1 }}>
            {toast.title}
          </AppText>
          {toast.note ? (
            <AppText variant="caption" style={{ color: c.toastMuted }}>
              {toast.note}
            </AppText>
          ) : null}
          {toast.action ? (
            <Pressable
              onPress={() => {
                hide();
                toast.action?.onPress();
              }}
              accessibilityRole="button"
              hitSlop={12}
              style={styles.action}
            >
              <AppText variant="label" style={{ color: c.isDark ? '#8A5A00' : c.brass, fontWeight: '800' }}>
                {toast.action.label}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.track, { backgroundColor: c.isDark ? '#D9D3C7' : '#2A3550' }]}>
          <Animated.View style={[styles.bar, { backgroundColor: c.toastInk }, barStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg },
  toast: { borderRadius: radius.field, paddingHorizontal: space.md + 2, paddingTop: space.md, paddingBottom: space.sm + 2, gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  action: { paddingHorizontal: space.xs, minHeight: 32, justifyContent: 'center' },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  bar: { height: 3, borderRadius: 2 },
});

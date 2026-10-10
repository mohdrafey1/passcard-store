import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { FONT, space, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

interface PinPadProps {
  length: 4 | 6;
  onComplete: (pin: string) => void;
  title: string;
  subtitle?: string;
  error?: string;
  /** Show the fingerprint key (bottom-left). */
  onBiometric?: () => void;
  disabled?: boolean;
  /** Change to clear the entry (e.g. between create and confirm). */
  resetKey?: string | number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'] as const;

export function PinPad({ length, onComplete, title, subtitle, error, onBiometric, disabled, resetKey }: PinPadProps) {
  const c = useTheme();
  const [pin, setPin] = useState('');
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const [lastError, setLastError] = useState(error);
  const shake = useSharedValue(0);

  // Clear the entry when asked to, or when a new error comes in.
  if (resetKey !== lastResetKey || error !== lastError) {
    if (resetKey !== lastResetKey || error) setPin('');
    setLastResetKey(resetKey);
    setLastError(error);
  }

  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    AccessibilityInfo.announceForAccessibility(error);
  }, [error, shake]);

  const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const press = (key: (typeof KEYS)[number]) => {
    if (disabled) return;
    if (key === 'bio') {
      onBiometric?.();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (key === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => {
      if (p.length >= length) return p;
      const next = p + key;
      if (next.length === length) {
        // Let the last dot render before handing off.
        setTimeout(() => onComplete(next), 120);
      }
      return next;
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="title" align="center" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" tone="ink2" align="center">
            {subtitle}
          </AppText>
        ) : null}
      </View>

      <Animated.View
        style={[styles.dots, dotsStyle]}
        accessible
        accessibilityLabel={`${pin.length} of ${length} digits entered`}
        accessibilityLiveRegion="polite"
      >
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length ? { backgroundColor: c.brass, borderColor: c.brass } : { borderColor: error ? c.danger : c.dotEmpty },
            ]}
          />
        ))}
      </Animated.View>
      <AppText variant="caption" tone="danger" align="center" style={styles.error}>
        {error ?? ''}
      </AppText>

      <View style={styles.grid}>
        {KEYS.map((key) => {
          if (key === 'bio' && !onBiometric) return <View key={key} style={styles.key} />;
          const isDigit = key !== 'bio' && key !== 'del';
          return (
            <Pressable
              key={key}
              onPress={() => press(key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={key === 'bio' ? 'Unlock with fingerprint' : key === 'del' ? 'Delete last digit' : key}
              style={({ pressed }) => [
                styles.key,
                isDigit && { backgroundColor: pressed ? c.raised : c.surface, borderColor: c.line, borderWidth: 1 },
                !isDigit && pressed && { backgroundColor: c.raised },
              ]}
            >
              {key === 'bio' ? (
                <Icon name="fingerprint" size={32} color={c.brassText} />
              ) : key === 'del' ? (
                <Icon name="backspace" size={26} color={c.ink2} />
              ) : (
                <AppText style={{ fontFamily: FONT, fontSize: 28, fontWeight: '600', color: c.ink }} maxFontSizeMultiplier={1.3}>
                  {key}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const KEY = 76;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  head: { gap: space.xs, paddingHorizontal: space.xxl },
  dots: { flexDirection: 'row', gap: space.lg, marginTop: space.lg },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  error: { minHeight: 36, paddingHorizontal: space.xxl },
  grid: { width: KEY * 3 + 28 * 2, flexDirection: 'row', flexWrap: 'wrap', columnGap: 28, rowGap: space.lg },
  key: { width: KEY, height: KEY, borderRadius: KEY / 2, alignItems: 'center', justifyContent: 'center' },
});

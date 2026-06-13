import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { Colors, FontSize, BorderRadius, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface PinPadProps {
  pinLength: 4 | 6;
  onComplete: (pin: string) => void;
  onBiometric?: () => void;
  showBiometric?: boolean;
  title?: string;
  subtitle?: string;
  error?: string;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function PinDot({ filled, error }: { filled: boolean; error: boolean }) {
  return (
    <View
      style={[
        styles.dot,
        filled && styles.dotFilled,
        error && styles.dotError,
      ]}
    />
  );
}

function PinButton({
  value,
  onPress,
  children,
  style: extraStyle,
}: {
  value: string;
  onPress: (v: string) => void;
  children?: React.ReactNode;
  style?: object;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.85, { damping: 15, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(value);
  }, [value, onPress, scale]);

  return (
    <AnimatedTouchable
      style={[styles.button, extraStyle, animatedStyle]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {children || <Text style={styles.buttonText}>{value}</Text>}
    </AnimatedTouchable>
  );
}

export default function PinPad({
  pinLength,
  onComplete,
  onBiometric,
  showBiometric = false,
  title = 'Enter PIN',
  subtitle,
  error,
}: PinPadProps) {
  const [pin, setPin] = useState('');

  const handlePress = useCallback(
    (digit: string) => {
      if (pin.length >= pinLength) return;
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === pinLength) {
        setTimeout(() => {
          onComplete(newPin);
          setPin('');
        }, 150);
      }
    },
    [pin, pinLength, onComplete],
  );

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin((prev) => prev.slice(0, -1));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.dotsContainer}>
        {Array.from({ length: pinLength }).map((_, i) => (
          <PinDot key={i} filled={i < pin.length} error={!!error} />
        ))}
      </View>

      <View style={styles.pad}>
        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((digit) => (
              <PinButton key={digit} value={digit} onPress={handlePress} />
            ))}
          </View>
        ))}
        <View style={styles.row}>
          {showBiometric && onBiometric ? (
            <PinButton value="bio" onPress={onBiometric} style={styles.specialButton}>
              <Ionicons name="finger-print" size={28} color={Colors.primary} />
            </PinButton>
          ) : (
            <View style={styles.emptyButton} />
          )}
          <PinButton value="0" onPress={handlePress} />
          <PinButton value="del" onPress={handleDelete} style={styles.specialButton}>
            <Ionicons name="backspace-outline" size={28} color={Colors.textSecondary} />
          </PinButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  error: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing['3xl'],
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.transparent,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.transparent,
  },
  pad: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.lg,
    justifyContent: 'center',
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: FontSize['2xl'],
    fontWeight: '600',
    color: Colors.text,
  },
  specialButton: {
    backgroundColor: Colors.transparent,
  },
  emptyButton: {
    width: 72,
    height: 72,
  },
});

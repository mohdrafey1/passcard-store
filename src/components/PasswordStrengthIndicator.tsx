import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

function calculatePasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(password)).length;
  if (variety >= 3) score++;
  if (variety >= 4) score++;
  return Math.min(4, score);
}

function getStrengthLabel(score: number): string {
  return ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][score] ?? 'Unknown';
}

interface Props {
  password: string;
}

const STRENGTH_COLORS = [
  Colors.strengthWeak,
  Colors.strengthWeak,
  Colors.strengthFair,
  Colors.strengthGood,
  Colors.strengthStrong,
];

export default function PasswordStrengthIndicator({ password }: Props) {
  const strength = calculatePasswordStrength(password);
  const label = getStrengthLabel(strength);
  const color = STRENGTH_COLORS[strength];

  if (!password) return null;

  return (
    <View style={styles.container}>
      <View style={styles.barContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.barSegment,
              { backgroundColor: i <= strength - 1 ? color : Colors.border },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  barContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  barSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },
});

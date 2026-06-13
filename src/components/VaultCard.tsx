import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme';

interface VaultCardProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export default function VaultCard({
  title,
  subtitle,
  rightText,
  leftIcon,
  onPress,
  onLongPress,
  children,
  style,
}: VaultCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, Shadow.sm, style]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      disabled={!onPress && !onLongPress}
    >
      <View style={styles.content}>
        {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
        {rightText && <Text style={styles.rightText}>{rightText}</Text>}
      </View>
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rightText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginLeft: Spacing.sm,
  },
});

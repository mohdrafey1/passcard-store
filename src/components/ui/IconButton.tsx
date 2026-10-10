import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { TOUCH, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only controls must be named for screen readers. */
  label: string;
  onPress: () => void;
  tone?: 'ink' | 'ink2' | 'brass' | 'danger' | 'onBrass';
  size?: number;
  filled?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityState?: { selected?: boolean; checked?: boolean };
}

/** 48dp touch target around a 22dp icon. */
export function IconButton({ icon, label, onPress, tone = 'ink', size = 22, filled, disabled, style, accessibilityState }: IconButtonProps) {
  const c = useTheme();
  const color = { ink: c.ink, ink2: c.ink2, brass: c.brassText, danger: c.danger, onBrass: c.onBrass }[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: TOUCH,
          height: TOUCH,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? c.brass : pressed ? c.raised : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={size} color={filled ? c.onBrass : color} />
    </Pressable>
  );
}

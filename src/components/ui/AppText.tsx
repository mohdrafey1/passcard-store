import React from 'react';
import { Text, type TextProps } from 'react-native';
import { type, useTheme, type Palette, type TypeVariant } from '@/theme';

type Tone = 'ink' | 'ink2' | 'muted' | 'brass' | 'danger' | 'success' | 'warn' | 'onBrass';

interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
}

function toneColor(c: Palette, tone: Tone): string {
  switch (tone) {
    case 'ink2':
      return c.ink2;
    case 'muted':
      return c.muted;
    case 'brass':
      return c.brassText;
    case 'danger':
      return c.danger;
    case 'success':
      return c.success;
    case 'warn':
      return c.warnText;
    case 'onBrass':
      return c.onBrass;
    default:
      return c.ink;
  }
}

/** Text in the app's type scale and palette. Scales with the system font size. */
export function AppText({ variant = 'body', tone = 'ink', align, style, ...rest }: AppTextProps) {
  const c = useTheme();
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={2}
      style={[type[variant], { color: toneColor(c, tone) }, align ? { textAlign: align } : null, style]}
    />
  );
}

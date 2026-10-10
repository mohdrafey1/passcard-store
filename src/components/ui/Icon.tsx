import React from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * One icon vocabulary for the app: Feather line icons, plus a few
 * MaterialCommunityIcons glyphs Feather lacks. Icons are decorative by default
 * (hidden from screen readers); controls carry their own labels.
 */
const MCI = {
  fingerprint: 'fingerprint',
  sparkle: 'star-four-points-outline',
  backspace: 'backspace-outline',
  'shield-check': 'shield-check-outline',
  'shield-alert': 'shield-alert-outline',
  'star-filled': 'star',
  'card-chip': 'integrated-circuit-chip',
  sort: 'sort',
} as const;

type MciName = keyof typeof MCI;
type FeatherName = React.ComponentProps<typeof Feather>['name'];
export type IconName = FeatherName | MciName;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
}

export function Icon({ name, size = 22, color }: IconProps) {
  if (name in MCI) {
    return (
      <MaterialCommunityIcons
        name={MCI[name as MciName]}
        size={size}
        color={color}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }
  return (
    <Feather
      name={name as FeatherName}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

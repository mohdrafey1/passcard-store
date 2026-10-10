import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CARD_FACES, space } from '@/theme';
import type { CardColor } from '@/types/card';
import { detectNetwork, formatCardNumber, formatExpiry } from '@/utils/cards';
import { AppText } from './AppText';

interface CardFaceProps {
  nickname: string;
  holder: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv?: string;
  color: CardColor;
  revealed?: boolean;
  /** Show only the top strip (wallet stack). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A flat card in the user's colour. The network is shown as text, not a logo. */
export function CardFace({ nickname, holder, number, expiryMonth, expiryYear, cvv, color, revealed, compact, style }: CardFaceProps) {
  const face = CARD_FACES[color];
  const network = detectNetwork(number);
  const last4 = number.slice(-4);
  const shownNumber = revealed ? formatCardNumber(number) : `••••  ••••  ••••  ${last4 || '••••'}`;
  const label = `${nickname || 'Card'}, ${network.id === 'unknown' ? 'card' : network.name} ending ${last4}`;

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.card, { backgroundColor: face.bg, borderColor: face.line }, compact && styles.compact, style]}
    >
      <View style={styles.top}>
        <AppText variant="bodyStrong" style={{ color: face.ink, flex: 1 }} numberOfLines={1}>
          {nickname || 'Card'}
        </AppText>
        {compact ? (
          <AppText variant="mono" style={{ color: face.label, fontSize: 14 }}>
            •• {last4}
          </AppText>
        ) : null}
        <AppText variant="label" style={{ color: face.ink, fontWeight: '800' }}>
          {network.id === 'unknown' ? '' : network.name}
        </AppText>
      </View>
      {compact ? null : (
        <>
          <View style={styles.middle}>
            <View style={[styles.chip, { backgroundColor: color === 'brass' ? '#E6C27A' : '#C9963A' }]}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.chipLine, { backgroundColor: '#8C6420' }]} />
              ))}
            </View>
            {cvv !== undefined ? (
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="caption" style={{ color: face.label }}>
                  CVV
                </AppText>
                <AppText variant="mono" style={{ color: face.ink, fontSize: 15 }}>
                  {revealed ? cvv || '—' : '•••'}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText variant="monoLarge" style={{ color: face.ink, fontSize: 19 }} numberOfLines={1} adjustsFontSizeToFit>
            {shownNumber}
          </AppText>
          <View style={styles.bottom}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" style={{ color: face.label }}>
                Card holder
              </AppText>
              <AppText variant="label" style={{ color: face.ink, letterSpacing: 0.6 }} numberOfLines={1}>
                {(holder || '—').toUpperCase()}
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="caption" style={{ color: face.label }}>
                Expires
              </AppText>
              <AppText variant="mono" style={{ color: face.ink, fontSize: 14, fontWeight: '600' }}>
                {formatExpiry(expiryMonth, expiryYear) || '—'}
              </AppText>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1.586,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.lg + 2,
    paddingBottom: space.xl,
    justifyContent: 'space-between',
  },
  compact: { aspectRatio: undefined, height: 72, justifyContent: 'flex-start' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  middle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { width: 44, height: 32, borderRadius: 7, justifyContent: 'space-evenly', paddingHorizontal: 6 },
  chipLine: { height: 1 },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
});

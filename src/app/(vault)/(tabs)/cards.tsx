import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { CardFace } from '@/components/ui/CardFace';
import { Icon } from '@/components/ui/Icon';
import { Banner, EmptyState, Screen } from '@/components/ui/Layout';
import { useCardStore } from '@/features/cards/store';
import { useCopySecret } from '@/features/vault/actions';
import { space, useTheme } from '@/theme';
import { expiryState, formatExpiry } from '@/utils/cards';

const STRIP = 72;

export default function CardsScreen() {
  const c = useTheme();
  const cards = useCardStore((s) => s.cards);
  const copy = useCopySecret();
  const ordered = useMemo(
    () => [...cards].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt)),
    [cards],
  );
  const [frontId, setFrontId] = useState<string | null>(null);
  const front = ordered.find((cd) => cd.id === frontId) ?? ordered[0];
  const behind = ordered.filter((cd) => cd.id !== front?.id);
  const attention = ordered
    .map((cd) => ({ card: cd, state: expiryState(cd.expiryMonth, cd.expiryYear) }))
    .filter((x) => x.state === 'expiring' || x.state === 'expired');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <AppText variant="display" accessibilityRole="header" style={{ flex: 1 }}>
            Cards
          </AppText>
          {cards.length ? (
            <AppText variant="caption" tone="muted">
              {cards.length} {cards.length === 1 ? 'card' : 'cards'}
            </AppText>
          ) : null}
        </View>

        {!front ? (
          <EmptyState icon="credit-card" title="No cards yet" body="Keep card numbers, expiry dates and CVVs encrypted here, ready to copy at checkout.">
            <Button label="Add a card" icon="plus" onPress={() => router.push('/card/edit')} />
          </EmptyState>
        ) : (
          <>
            <View>
              {behind.map((cd) => (
                <Pressable
                  key={cd.id}
                  onPress={() => setFrontId(cd.id)}
                  accessibilityRole="button"
                  accessibilityHint="Brings this card to the front"
                  style={{ height: STRIP - 12 }}
                >
                  <CardFace
                    compact
                    nickname={cd.cardNickname}
                    holder={cd.cardHolderName}
                    number={cd.cardNumber}
                    expiryMonth={cd.expiryMonth}
                    expiryYear={cd.expiryYear}
                    color={cd.color}
                  />
                </Pressable>
              ))}
              <Pressable onPress={() => router.push(`/card/${front.id}`)} accessibilityRole="button" accessibilityHint="Opens card details">
                <CardFace
                  nickname={front.cardNickname}
                  holder={front.cardHolderName}
                  number={front.cardNumber}
                  expiryMonth={front.expiryMonth}
                  expiryYear={front.expiryYear}
                  color={front.color}
                />
              </Pressable>
            </View>

            <View style={styles.quick}>
              <Button style={styles.quickButton} variant="secondary" label="Number" icon="copy" onPress={() => copy(front.cardNumber, 'Card number', { kind: 'card', id: front.id })} />
              <Button
                style={styles.quickButton}
                variant="secondary"
                label="Expiry"
                icon="copy"
                onPress={() => copy(formatExpiry(front.expiryMonth, front.expiryYear), 'Expiry', { kind: 'card', id: front.id })}
              />
              <Button style={styles.quickButton} variant="secondary" label="CVV" icon="copy" onPress={() => copy(front.cvv, 'CVV', { kind: 'card', id: front.id })} />
            </View>
            <AppText variant="caption" tone="muted" align="center">
              {behind.length ? 'Tap a card to bring it forward. ' : ''}Tap the front card for details.
            </AppText>

            {attention.map(({ card, state }) => (
              <Banner
                key={card.id}
                tone={state === 'expired' ? 'danger' : 'warn'}
                icon="clock"
                title={`${card.cardNickname || 'A card'} ${state === 'expired' ? 'has expired' : 'expires soon'}`}
                body={`${formatExpiry(card.expiryMonth, card.expiryYear)} · update it when the new card arrives`}
                action="Update"
                onPress={() => router.push(`/card/edit?id=${card.id}`)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {front ? (
        <Pressable
          onPress={() => router.push('/card/edit')}
          accessibilityRole="button"
          accessibilityLabel="Add card"
          style={({ pressed }) => [styles.fab, { backgroundColor: c.brass, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon name="plus" size={26} color={c.onBrass} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingTop: space.lg, gap: space.lg, paddingBottom: 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  quick: { flexDirection: 'row', gap: space.sm },
  quickButton: { flex: 1, paddingHorizontal: space.sm },
  fab: { position: 'absolute', right: space.xl, bottom: space.xl, width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});

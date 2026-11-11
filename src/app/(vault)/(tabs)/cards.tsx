import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { CardFace } from '@/components/ui/CardFace';
import { Icon } from '@/components/ui/Icon';
import { Banner, EmptyState, Screen } from '@/components/ui/Layout';
import { useCardStore } from '@/features/cards/store';
import { space, useTheme } from '@/theme';
import { expiryState, formatExpiry } from '@/utils/cards';

export default function CardsScreen() {
  const c = useTheme();
  const cards = useCardStore((s) => s.cards);
  const ordered = useMemo(
    () => [...cards].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt)),
    [cards],
  );
  const attention = ordered
    .map((cd) => ({ card: cd, state: expiryState(cd.expiryMonth, cd.expiryYear) }))
    .filter((x) => x.state === 'expiring' || x.state === 'expired');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        {ordered.length === 0 ? (
          <EmptyState
            icon="credit-card"
            title="No cards yet"
            body="Keep card numbers, expiry dates and CVVs encrypted here, ready to copy at checkout."
          >
            <Button label="Add a card" icon="plus" onPress={() => router.push('/card/edit')} />
          </EmptyState>
        ) : (
          <>
            {attention.map(({ card, state }) => (
              <Banner
                key={`attn-${card.id}`}
                tone={state === 'expired' ? 'danger' : 'warn'}
                icon="clock"
                title={`${card.cardNickname || 'A card'} ${state === 'expired' ? 'has expired' : 'expires soon'}`}
                body={`${formatExpiry(card.expiryMonth, card.expiryYear)} · update it when the new card arrives`}
                action="Update"
                onPress={() => router.push(`/card/edit?id=${card.id}`)}
              />
            ))}

            {ordered.map((cd) => (
              <Pressable
                key={cd.id}
                onPress={() => router.push(`/card/${cd.id}`)}
                accessibilityRole="button"
                accessibilityHint="Opens card details"
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <CardFace
                  nickname={cd.cardNickname}
                  holder={cd.cardHolderName}
                  number={cd.cardNumber}
                  expiryMonth={cd.expiryMonth}
                  expiryYear={cd.expiryYear}
                  color={cd.color}
                />
              </Pressable>
            ))}

            <AppText variant="caption" tone="muted" align="center">
              Tap a card for details and to copy its number, expiry or CVV.
            </AppText>
          </>
        )}
      </ScrollView>

      {ordered.length > 0 ? (
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
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xl,
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});

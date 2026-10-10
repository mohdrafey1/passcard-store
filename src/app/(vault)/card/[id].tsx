import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { CardFace } from '@/components/ui/CardFace';
import { Badge } from '@/components/ui/Controls';
import { IconButton } from '@/components/ui/IconButton';
import { DetailRow, EmptyState, Group } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { useCardStore } from '@/features/cards/store';
import { deleteWithUndo, toggleFavorite, useCopySecret } from '@/features/vault/actions';
import { formatDate } from '@/features/vault/items';
import { radius, space, useTheme } from '@/theme';
import { detectNetwork, expiryState, formatCardNumber, formatExpiry, maskCardNumber } from '@/utils/cards';
import { shareCard } from '@/utils/share';

const REVEAL_SECONDS = 20;

export default function CardDetailScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useCardStore((s) => s.cards.find((cd) => cd.id === id));
  const copy = useCopySecret();
  const [hidesIn, setHidesIn] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const revealed = hidesIn > 0;

  // Count down and hide the full number and CVV again.
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setHidesIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [hidesIn, revealed]);

  if (!card) {
    return (
      <EmptyState icon="slash" title="This card is gone" body="It was deleted or moved to Recently deleted.">
        <Button label="Back to cards" variant="secondary" onPress={() => router.back()} />
      </EmptyState>
    );
  }

  const ref = { kind: 'card' as const, id: card.id };
  const network = detectNetwork(card.cardNumber);
  const expiry = expiryState(card.expiryMonth, card.expiryYear);
  const title = card.cardNickname || network.name;

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                icon={card.favorite ? 'star-filled' : 'star'}
                label={card.favorite ? 'Remove from favourites' : 'Add to favourites'}
                tone={card.favorite ? 'brass' : 'ink'}
                onPress={() => void toggleFavorite(ref)}
              />
              <IconButton icon="edit-2" label="Edit card" onPress={() => router.push(`/card/edit?id=${card.id}`)} />
              <IconButton icon="more-vertical" label="More actions" onPress={() => setMoreOpen(true)} />
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <CardFace
          nickname={card.cardNickname}
          holder={card.cardHolderName}
          number={card.cardNumber}
          expiryMonth={card.expiryMonth}
          expiryYear={card.expiryYear}
          cvv={card.cvv}
          color={card.color}
          revealed={revealed}
        />
        <Button
          variant="secondary"
          icon={revealed ? 'eye-off' : 'eye'}
          label={revealed ? `Hide details · hides in ${hidesIn}s` : 'Show details'}
          onPress={() => setHidesIn(revealed ? 0 : REVEAL_SECONDS)}
        />

        <Group>
          <DetailRow label="Card number" value={revealed ? formatCardNumber(card.cardNumber) : maskCardNumber(card.cardNumber)} mono>
            <IconButton icon="copy" tone="brass" label="Copy card number" onPress={() => copy(card.cardNumber, 'Card number', ref)} />
          </DetailRow>
          <DetailRow label="Expiry" value={formatExpiry(card.expiryMonth, card.expiryYear) || 'Not set'} mono>
            <IconButton icon="copy" tone="brass" label="Copy expiry" onPress={() => copy(formatExpiry(card.expiryMonth, card.expiryYear), 'Expiry', ref)} />
          </DetailRow>
          <DetailRow label="CVV" value={revealed ? card.cvv || 'Not set' : '•'.repeat(network.cvvLength)} mono>
            <IconButton icon="copy" tone="brass" label="Copy CVV" onPress={() => copy(card.cvv, 'CVV', ref)} />
          </DetailRow>
          {card.cardHolderName ? (
            <DetailRow label="Card holder" value={card.cardHolderName}>
              <IconButton icon="copy" tone="brass" label="Copy card holder" onPress={() => copy(card.cardHolderName, 'Card holder', ref)} />
            </DetailRow>
          ) : null}
        </Group>

        <View style={[styles.info, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={styles.infoRow}>
            <AppText variant="caption" tone="muted">
              Network
            </AppText>
            <View style={styles.infoValue}>
              <AppText variant="label">{network.id === 'unknown' ? 'Not recognised' : network.name}</AppText>
              {expiry === 'expired' ? <Badge label="Expired" tone="danger" /> : null}
              {expiry === 'expiring' ? <Badge label="Expires soon" tone="warn" /> : null}
            </View>
          </View>
          {card.notes ? (
            <View style={{ gap: 2, paddingTop: space.sm }}>
              <AppText variant="caption" tone="muted">
                Notes
              </AppText>
              <AppText variant="body">{card.notes}</AppText>
            </View>
          ) : null}
        </View>

        <AppText variant="caption" tone="muted">
          Added {formatDate(card.createdAt)} · Edited {formatDate(card.updatedAt)}
        </AppText>

        <Button
          label="Move to Recently deleted"
          variant="danger"
          icon="trash-2"
          onPress={() => {
            void deleteWithUndo(ref, title);
            router.back();
          }}
        />
      </ScrollView>

      <Sheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={title}
        options={[
          { label: 'Share without secrets', detail: 'Name, last 4 digits and expiry', icon: 'share-2', onPress: () => void shareCard(card) },
          {
            label: 'Share full details',
            detail: 'Sends the number and CVV in plain text',
            icon: 'alert-triangle',
            onPress: () =>
              Alert.alert('Share the full card?', 'The number and CVV leave the vault as plain text. Anyone who sees them can pay with this card.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Share', style: 'destructive', onPress: () => void shareCard(card, true) },
              ]),
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', marginRight: -space.sm },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.huge },
  info: { borderWidth: 1, borderRadius: radius.group, padding: space.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  infoValue: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

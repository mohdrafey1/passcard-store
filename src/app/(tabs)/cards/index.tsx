import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow, CardGradient } from '@/constants/theme';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
import ActionSheet, { type SheetAction } from '@/components/ActionSheet';
import { useCardStore } from '@/features/cards/store';
import { useSettingsStore } from '@/features/settings/store';
import { copyToClipboard } from '@/utils/clipboard';
import { showToast } from '@/utils/toast';
import { shareCard } from '@/utils/share';
import { useDebounce } from '@/hooks/useDebounce';
import type { CardEntry } from '@/types/card';
import { LinearGradient } from 'expo-linear-gradient';

const REVEAL_TIMEOUT_MS = 20 * 1000;

function CreditCardWidget({ card, onPress, onLongPress }: { card: CardEntry; onPress: () => void; onLongPress: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide sensitive details after a short window to limit shoulder-surfing.
  useEffect(() => {
    if (revealed) {
      timerRef.current = setTimeout(() => setRevealed(false), REVEAL_TIMEOUT_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [revealed]);

  const maskedNumber = `•••• •••• •••• ${card.cardNumber.slice(-4)}`;
  const displayNumber = revealed
    ? card.cardNumber.replace(/(.{4})/g, '$1 ').trim()
    : maskedNumber;

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
      <LinearGradient
        colors={CardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.creditCard, Shadow.md]}
      >
        {/* soft highlight */}
        <View style={styles.cardGlow} pointerEvents="none" />

        <View style={styles.cardTop}>
          <View>
            <Text style={styles.cardBrand}>PASSCARD</Text>
            <Text style={styles.cardNickname} numberOfLines={1}>{card.cardNickname || 'Card'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setRevealed(!revealed)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide card details' : 'Reveal card details'}
            hitSlop={10}
            style={styles.eyeButton}
          >
            <Ionicons name={revealed ? 'eye-off' : 'eye'} size={18} color={Colors.primaryLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <View style={styles.chipLineH} />
            <View style={styles.chipLineV} />
          </View>
          <Ionicons name="wifi" size={22} color="#E8CE9A" style={styles.contactless} />
        </View>

        <Text style={styles.cardNumber}>{displayNumber}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.footerBlock}>
            <Text style={styles.cardLabel}>CARD HOLDER</Text>
            <Text style={styles.cardValue} numberOfLines={1}>{card.cardHolderName || '—'}</Text>
          </View>
          <View style={styles.footerBlockSm}>
            <Text style={styles.cardLabel}>EXPIRES</Text>
            <Text style={styles.cardValue}>{card.expiryMonth}/{card.expiryYear}</Text>
          </View>
          <View style={styles.footerBlockSm}>
            <Text style={styles.cardLabel}>CVV</Text>
            <Text style={styles.cardValue}>{revealed ? card.cvv : '•••'}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function CardListScreen() {
  const { cards, loading, load, remove } = useCardStore();
  const clipboardDuration = useSettingsStore((s) => s.clipboardClearDuration);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionItem, setActionItem] = useState<CardEntry | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (debouncedSearch) {
      useCardStore.getState().search(debouncedSearch);
    } else {
      load();
    }
  }, [debouncedSearch]);

  // Reload on focus so adds/edits/deletes made on child screens are reflected
  // (the list stays mounted-but-frozen while a child screen is open).
  useFocusEffect(
    useCallback(() => {
      if (!debouncedSearch) load();
    }, [debouncedSearch]),
  );

  // The store already narrows `cards` to search results when searching, so the
  // list can render it directly (no fragile "call the selector" pattern).
  const filtered = cards;

  const confirmDelete = useCallback((item: CardEntry) => {
    Alert.alert('Delete Card', `Delete "${item.cardNickname || 'this card'}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(item.id) },
    ]);
  }, [remove]);

  const actionItemActions: SheetAction[] = actionItem
    ? [
        { label: 'Copy Card Number', icon: 'card-outline', onPress: () => { copyToClipboard(actionItem.cardNumber, clipboardDuration); showToast('Card number copied'); } },
        { label: 'Copy CVV', icon: 'lock-closed-outline', onPress: () => { copyToClipboard(actionItem.cvv, clipboardDuration); showToast('CVV copied'); } },
        { label: 'Copy Expiry', icon: 'calendar-outline', onPress: () => { copyToClipboard(`${actionItem.expiryMonth}/${actionItem.expiryYear}`, clipboardDuration); showToast('Expiry copied'); } },
        { label: 'Share', icon: 'share-outline', onPress: () => shareCard(actionItem) },
        { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(actionItem) },
      ]
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Cards</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(tabs)/cards/add')} accessibilityRole="button" accessibilityLabel="Add card">
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search cards..." />
      </View>

      <FlatList
        data={filtered}
        renderItem={({ item }) => (
          <CreditCardWidget
            card={item}
            onPress={() => router.push(`/(tabs)/cards/${item.id}`)}
            onLongPress={() => setActionItem(item)}
          />
        )}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <EmptyState
              icon="card-outline"
              title={debouncedSearch ? 'No matches found' : 'No cards yet'}
              subtitle={debouncedSearch ? 'Try a different search' : 'Tap + to add your first card'}
            />
          )
        }
      />

      <ActionSheet
        visible={!!actionItem}
        onClose={() => setActionItem(null)}
        title={actionItem?.cardNickname || 'Card'}
        subtitle={actionItem ? `•••• ${actionItem.cardNumber.slice(-4)}` : undefined}
        actions={actionItemActions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing['4xl'] },
  creditCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.base, minHeight: 208, justifyContent: 'space-between', overflow: 'hidden' },
  cardGlow: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(240, 193, 75, 0.14)',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardBrand: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: 'rgba(240,193,75,0.75)' },
  cardNickname: { fontSize: FontSize.md, fontWeight: '700', color: '#FFFFFF', marginTop: 3, maxWidth: 190 },
  eyeButton: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  chip: {
    width: 44, height: 34, borderRadius: 7,
    backgroundColor: '#E7C25C',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  chipLineH: { position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(90,60,10,0.4)' },
  chipLineV: { position: 'absolute', height: '100%', width: 1, backgroundColor: 'rgba(90,60,10,0.4)' },
  contactless: { transform: [{ rotate: '90deg' }], opacity: 0.85 },
  cardNumber: { fontSize: 19, fontWeight: '700', color: '#FFFFFF', letterSpacing: 2, marginVertical: Spacing.md, fontFamily: 'monospace' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerBlock: { flex: 1, marginRight: Spacing.md },
  footerBlockSm: { alignItems: 'flex-start', marginLeft: Spacing.lg },
  cardLabel: { fontSize: 9, color: 'rgba(224,206,154,0.75)', letterSpacing: 1, marginBottom: 3 },
  cardValue: { fontSize: FontSize.sm, fontWeight: '600', color: '#FFFFFF' },
});

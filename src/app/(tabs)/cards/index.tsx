import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
import ActionSheet, { type SheetAction } from '@/components/ActionSheet';
import { useCardStore } from '@/features/cards/store';
import { useSettingsStore } from '@/features/settings/store';
import { copyToClipboard } from '@/utils/clipboard';
import { shareCard } from '@/utils/share';
import { useDebounce } from '@/hooks/useDebounce';
import type { CardEntry } from '@/types/card';
import { LinearGradient } from 'expo-linear-gradient';

function CreditCardWidget({ card, onPress, onLongPress }: { card: CardEntry; onPress: () => void; onLongPress: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const maskedNumber = `•••• •••• •••• ${card.cardNumber.slice(-4)}`;
  const displayNumber = revealed
    ? card.cardNumber.replace(/(.{4})/g, '$1 ').trim()
    : maskedNumber;

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8}>
      <LinearGradient
        colors={['#3D2E22', '#1F1712', '#130E0A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.creditCard, Shadow.md]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardNickname}>{card.cardNickname || 'Card'}</Text>
          <TouchableOpacity onPress={() => setRevealed(!revealed)}>
            <Ionicons name={revealed ? 'eye-off' : 'eye'} size={20} color={Colors.primaryLight} />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardNumber}>{displayNumber}</Text>
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.cardLabel}>CARD HOLDER</Text>
            <Text style={styles.cardValue}>{card.cardHolderName}</Text>
          </View>
          <View>
            <Text style={styles.cardLabel}>EXPIRY</Text>
            <Text style={styles.cardValue}>{card.expiryMonth}/{card.expiryYear}</Text>
          </View>
          <View>
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

  const filtered = useCardStore((s) => s.getFiltered)();

  const confirmDelete = useCallback((item: CardEntry) => {
    Alert.alert('Delete Card', `Delete "${item.cardNickname || 'this card'}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(item.id) },
    ]);
  }, [remove]);

  const actionItemActions: SheetAction[] = actionItem
    ? [
        { label: 'Copy Card Number', icon: 'card-outline', onPress: () => copyToClipboard(actionItem.cardNumber, clipboardDuration) },
        { label: 'Copy CVV', icon: 'lock-closed-outline', onPress: () => copyToClipboard(actionItem.cvv, clipboardDuration) },
        { label: 'Copy Expiry', icon: 'calendar-outline', onPress: () => copyToClipboard(`${actionItem.expiryMonth}/${actionItem.expiryYear}`, clipboardDuration) },
        { label: 'Share', icon: 'share-outline', onPress: () => shareCard(actionItem) },
        { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(actionItem) },
      ]
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Cards</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(tabs)/cards/add')}>
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
          <EmptyState icon="card-outline" title="No cards yet" subtitle="Tap + to add your first card" />
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
  creditCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.base, minHeight: 200, justifyContent: 'space-between' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNickname: { fontSize: FontSize.base, fontWeight: '600', color: Colors.primaryLight },
  cardNumber: { fontSize: FontSize.lg, fontWeight: '700', color: '#FFFFFF', letterSpacing: 3, marginVertical: Spacing.lg, fontFamily: 'monospace' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { fontSize: 9, color: '#B0A090', letterSpacing: 1, marginBottom: 2 },
  cardValue: { fontSize: FontSize.sm, fontWeight: '600', color: '#FFFFFF' },
});

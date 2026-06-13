import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
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
        colors={['#2D1B69', '#1A1145', '#0D0A2E']}
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
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (debouncedSearch) {
      useCardStore.getState().search(debouncedSearch);
    } else {
      load();
    }
  }, [debouncedSearch]);

  const filtered = useCardStore((s) => s.getFiltered)();

  const handleLongPress = useCallback((item: CardEntry) => {
    Alert.alert(item.cardNickname || 'Card', 'Choose an action', [
      { text: 'Copy Card Number', onPress: () => copyToClipboard(item.cardNumber, clipboardDuration) },
      { text: 'Copy CVV', onPress: () => copyToClipboard(item.cvv, clipboardDuration) },
      { text: 'Copy Expiry', onPress: () => copyToClipboard(`${item.expiryMonth}/${item.expiryYear}`, clipboardDuration) },
      { text: 'Share', onPress: () => shareCard(item) },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => Alert.alert('Delete', `Delete this card?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => remove(item.id) },
        ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [clipboardDuration, remove]);

  return (
    <SafeAreaView style={styles.container}>
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
            onLongPress={() => handleLongPress(item)}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="card-outline" title="No cards yet" subtitle="Tap + to add your first card" />
        }
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
  listContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] },
  creditCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.base, minHeight: 200, justifyContent: 'space-between' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNickname: { fontSize: FontSize.base, fontWeight: '600', color: Colors.primaryLight },
  cardNumber: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, letterSpacing: 3, marginVertical: Spacing.lg, fontFamily: 'monospace' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { fontSize: 9, color: Colors.textMuted, letterSpacing: 1, marginBottom: 2 },
  cardValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
});

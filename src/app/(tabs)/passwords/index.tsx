import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import SearchBar from '@/components/SearchBar';
import VaultCard from '@/components/VaultCard';
import EmptyState from '@/components/EmptyState';
import ActionSheet, { type SheetAction } from '@/components/ActionSheet';
import { usePasswordStore } from '@/features/passwords/store';
import { copyToClipboard } from '@/utils/clipboard';
import { showToast } from '@/utils/toast';
import { sharePassword } from '@/utils/share';
import { CATEGORY_ICONS, DEFAULT_CATEGORIES } from '@/constants/categories';
import { useSettingsStore } from '@/features/settings/store';
import type { PasswordEntry, PasswordCategory } from '@/types/password';
import { useDebounce } from '@/hooks/useDebounce';

export default function PasswordListScreen() {
  const params = useLocalSearchParams<{ search?: string }>();
  const { passwords, loading, load, remove, duplicate, search, selectedCategory, setCategory } = usePasswordStore();
  const clipboardDuration = useSettingsStore((s) => s.clipboardClearDuration);
  const [searchQuery, setSearchQuery] = useState(params.search || '');
  const [actionItem, setActionItem] = useState<PasswordEntry | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (debouncedSearch) {
      search(debouncedSearch);
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keep the field in sync when arriving from the dashboard with a new query
  // (params.search changes on each navigation).
  useEffect(() => {
    if (params.search !== undefined) setSearchQuery(params.search);
  }, [params.search]);

  // Reload from the database whenever the screen regains focus (e.g. after
  // adding, editing or deleting an entry on another screen). The list screen
  // stays mounted-but-frozen while a child screen is open, so store updates
  // made there don't always re-render it until we explicitly refresh here.
  useFocusEffect(
    useCallback(() => {
      if (!debouncedSearch) load();
    }, [debouncedSearch]),
  );

  // Text search is already applied by the store (search results live in
  // `passwords`); here we only layer on the category filter. Computing it with
  // useMemo avoids the fragile "call the selector" pattern.
  const filtered = useMemo(() => {
    if (selectedCategory === 'All') return passwords;
    return passwords.filter((p) => p.category === selectedCategory);
  }, [passwords, selectedCategory]);

  const confirmDelete = useCallback((item: PasswordEntry) => {
    Alert.alert('Delete Password', `Delete "${item.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(item.id) },
    ]);
  }, [remove]);

  const actionItemActions: SheetAction[] = actionItem
    ? [
        { label: 'Copy Password', icon: 'key-outline', onPress: () => { copyToClipboard(actionItem.password, clipboardDuration); showToast('Password copied'); } },
        ...(actionItem.email
          ? [{ label: 'Copy Email', icon: 'mail-outline', onPress: () => { copyToClipboard(actionItem.email, clipboardDuration); showToast('Email copied'); } } as SheetAction]
          : []),
        ...(actionItem.username
          ? [{ label: 'Copy Username', icon: 'person-outline', onPress: () => { copyToClipboard(actionItem.username, clipboardDuration); showToast('Username copied'); } } as SheetAction]
          : []),
        { label: 'Share', icon: 'share-outline', onPress: () => sharePassword(actionItem) },
        { label: 'Duplicate', icon: 'copy-outline', onPress: () => duplicate(actionItem.id) },
        { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(actionItem) },
      ]
    : [];

  const renderItem = ({ item }: { item: PasswordEntry }) => (
    <VaultCard
      title={item.title}
      subtitle={item.website || item.email}
      leftIcon={<Text style={{ fontSize: 18 }}>{CATEGORY_ICONS[item.category] || '🔒'}</Text>}
      rightText={item.category}
      onPress={() => router.push(`/(tabs)/passwords/${item.id}`)}
      onLongPress={() => setActionItem(item)}
    />
  );

  const categories = ['All', ...DEFAULT_CATEGORIES] as const;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Passwords</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(tabs)/passwords/add')}
          accessibilityRole="button"
          accessibilityLabel="Add password"
        >
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search passwords..." />
      </View>

      {/* Category Pills */}
      <FlatList
        horizontal
        data={categories}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryListWrap}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
            onPress={() => setCategory(cat as PasswordCategory | 'All')}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === cat }}
            accessibilityLabel={`Filter by ${cat}`}
          >
            <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item}
      />

      <FlatList
        data={filtered}
        renderItem={renderItem}
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
              icon="key-outline"
              title={debouncedSearch ? 'No matches found' : 'No passwords yet'}
              subtitle={debouncedSearch ? 'Try a different search' : 'Tap + to add your first password'}
            />
          )
        }
      />

      <ActionSheet
        visible={!!actionItem}
        onClose={() => setActionItem(null)}
        title={actionItem?.title}
        subtitle={actionItem?.website || actionItem?.email || undefined}
        actions={actionItemActions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  addButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  searchContainer: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  categoryListWrap: { flexGrow: 0, marginBottom: Spacing.sm },
  categoryList: { paddingHorizontal: Spacing.base, gap: Spacing.sm, alignItems: 'center' },
  categoryPill: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  categoryPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  categoryTextActive: { color: Colors.white },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing['4xl'] },
});

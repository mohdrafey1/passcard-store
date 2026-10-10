import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ChipRow } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Banner, EmptyState, Screen } from '@/components/ui/Layout';
import { Sheet, type SheetOption } from '@/components/ui/Sheet';
import { VaultRow } from '@/components/VaultRow';
import { useCardStore } from '@/features/cards/store';
import { usePasswordStore } from '@/features/passwords/store';
import { lockVault } from '@/features/session/session';
import { useSettingsStore } from '@/features/settings/store';
import { deleteWithUndo, toggleFavorite, useCopySecret } from '@/features/vault/actions';
import {
  backupNudge,
  filterItems,
  SORT_LABELS,
  sortItems,
  toItems,
  type SortMode,
  type VaultFilter,
  type VaultItem,
} from '@/features/vault/items';
import { passwordRepository } from '@/storage/password-repository';
import { cardRepository } from '@/storage/card-repository';
import { FONT, radius, space, useTheme } from '@/theme';
import { BACKUP_REMINDER_OPTIONS } from '@/types/settings';
import { formatExpiry } from '@/utils/cards';

export default function VaultScreen() {
  const c = useTheme();
  const passwords = usePasswordStore((s) => s.passwords);
  const cards = useCardStore((s) => s.cards);
  const { categories, lastBackupAt, backupReminder } = useSettingsStore();
  const copy = useCopySecret();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VaultFilter>('all');
  const [sort, setSort] = useState<SortMode>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menuItem, setMenuItem] = useState<VaultItem | null>(null);

  const all = useMemo(() => toItems(passwords, cards), [passwords, cards]);
  const items = useMemo(() => sortItems(filterItems(all, query, filter), sort), [all, query, filter, sort]);

  const usedCategories = useMemo(() => categories.filter((cat) => passwords.some((p) => p.category === cat)), [categories, passwords]);
  const chips = [
    { value: 'all' as VaultFilter, label: 'All' },
    { value: 'favorites' as VaultFilter, label: 'Favourites' },
    { value: 'logins' as VaultFilter, label: 'Logins' },
    { value: 'cards' as VaultFilter, label: 'Cards' },
    ...usedCategories.map((cat) => ({ value: `category:${cat}` as VaultFilter, label: cat })),
  ];
  const filterLabel = chips.find((ch) => ch.value === filter)?.label ?? 'All';

  const reminderDays = BACKUP_REMINDER_OPTIONS.find((o) => o.value === backupReminder)?.days ?? null;
  const nudge = backupNudge(lastBackupAt, reminderDays, all.length);
  const unreadable = passwordRepository.unreadable + cardRepository.unreadable;

  const open = (item: VaultItem) => router.push(item.kind === 'login' ? `/login/${item.id}` : `/card/${item.id}`);
  const copyMain = (item: VaultItem) =>
    item.kind === 'login'
      ? copy(item.entry.password, 'Password', item)
      : copy(item.entry.cardNumber, 'Card number', item);

  const menuOptions = (item: VaultItem): SheetOption[] => {
    const common: SheetOption[] = [
      { label: item.entry.favorite ? 'Remove from favourites' : 'Add to favourites', icon: 'star', onPress: () => void toggleFavorite(item) },
      { label: 'Edit', icon: 'edit-2', onPress: () => router.push(item.kind === 'login' ? `/login/edit?id=${item.id}` : `/card/edit?id=${item.id}`) },
      { label: 'Delete', icon: 'trash-2', destructive: true, onPress: () => void deleteWithUndo(item, item.title) },
    ];
    if (item.kind === 'login') {
      const p = item.entry;
      return [
        { label: 'Copy password', icon: 'copy', onPress: () => void copy(p.password, 'Password', item) },
        ...(p.username ? [{ label: 'Copy username', icon: 'user' as const, onPress: () => void copy(p.username, 'Username', item) }] : []),
        ...(p.email ? [{ label: 'Copy email', icon: 'mail' as const, onPress: () => void copy(p.email, 'Email', item) }] : []),
        ...common,
      ];
    }
    const cd = item.entry;
    return [
      { label: 'Copy card number', icon: 'copy', onPress: () => void copy(cd.cardNumber, 'Card number', item) },
      { label: 'Copy expiry', icon: 'calendar', onPress: () => void copy(formatExpiry(cd.expiryMonth, cd.expiryYear), 'Expiry', item) },
      { label: 'Copy CVV', icon: 'hash', onPress: () => void copy(cd.cvv, 'CVV', item) },
      ...common,
    ];
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <AppText variant="display" accessibilityRole="header" style={{ flex: 1 }}>
          Vault
        </AppText>
        <IconButton icon="sparkle" label="Password generator" onPress={() => router.push('/generator')} />
        <IconButton icon="lock" label="Lock now" onPress={lockVault} style={{ marginRight: -space.sm }} />
      </View>

      <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Icon name="search" size={20} color={c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search logins and cards"
          placeholderTextColor={c.muted}
          accessibilityLabel="Search logins and cards"
          autoCorrect={false}
          autoCapitalize="none"
          importantForAutofill="no"
          returnKeyType="search"
          style={[styles.searchInput, { color: c.ink }]}
        />
        {query ? <IconButton icon="x" label="Clear search" onPress={() => setQuery('')} size={18} tone="ink2" /> : null}
      </View>

      <ChipRow options={chips} value={filter} onChange={setFilter} label="Filter" inset={space.xl} />

      {nudge.due ? (
        <Banner
          tone="warn"
          icon="shield"
          title={nudge.days === null ? 'No backup yet.' : `Last backup ${nudge.days} days ago.`}
          body="If this phone is lost, the vault is lost."
          action="Back up"
          onPress={() => router.push('/settings/backup')}
        />
      ) : null}
      {unreadable > 0 ? (
        <Banner
          tone="danger"
          icon="alert-circle"
          title={`${unreadable} item${unreadable === 1 ? '' : 's'} couldn't be read`}
          body="They were left untouched. Restoring a backup brings them back."
        />
      ) : null}

      {all.length > 0 ? (
        <View style={styles.listHead}>
          <AppText variant="overline" tone="muted">
            {filterLabel} · {items.length}
          </AppText>
          <Pressable
            onPress={() => setSortOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${SORT_LABELS[sort]}. Change sort`}
            style={styles.sortButton}
            hitSlop={8}
          >
            <Icon name="sort" size={16} color={c.ink2} />
            <AppText variant="caption" tone="ink2" style={{ fontWeight: '700' }}>
              {SORT_LABELS[sort]}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => (
          <VaultRow
            item={item}
            onOpen={() => open(item)}
            onCopy={() => void copyMain(item)}
            onFavorite={() => void toggleFavorite(item)}
            onMore={() => setMenuItem(item)}
            onDelete={() => void deleteWithUndo(item, item.title)}
          />
        )}
        ListEmptyComponent={
          all.length === 0 ? (
            <EmptyState icon="key" title="Your vault is empty" body="Add a login or card, or bring everything over from another password manager.">
              <Button label="Add a login" icon="plus" onPress={() => router.push('/login/edit')} />
              <Button label="Import from another app" variant="secondary" onPress={() => router.push('/settings/import')} />
            </EmptyState>
          ) : (
            <EmptyState icon="search" title="Nothing matches" body={query ? `No results for “${query}”.` : `No items in ${filterLabel}.`}>
              <Button
                label="Show everything"
                variant="secondary"
                onPress={() => {
                  setQuery('');
                  setFilter('all');
                }}
              />
            </EmptyState>
          )
        }
      />

      {all.length > 0 ? (
        <Pressable
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add item"
          style={({ pressed }) => [styles.fab, { backgroundColor: c.brass, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon name="plus" size={26} color={c.onBrass} />
        </Pressable>
      ) : null}

      <Sheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort by"
        choice
        options={(Object.keys(SORT_LABELS) as SortMode[]).map((m) => ({ label: SORT_LABELS[m], selected: m === sort, onPress: () => setSort(m) }))}
      />
      <Sheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add to vault"
        options={[
          { label: 'Login', detail: 'A website or app account', icon: 'key', onPress: () => router.push('/login/edit') },
          { label: 'Card', detail: 'A credit or debit card', icon: 'credit-card', onPress: () => router.push('/card/edit') },
        ]}
      />
      <Sheet
        visible={menuItem !== null}
        onClose={() => setMenuItem(null)}
        title={menuItem?.title}
        subtitle={menuItem?.subtitle}
        options={menuItem ? menuOptions(menuItem) : []}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.md + 2, paddingBottom: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: 50, borderRadius: radius.field, borderWidth: 1, paddingLeft: space.lg - 2, paddingRight: space.xs },
  searchInput: { flex: 1, fontFamily: FONT, fontSize: 16, fontWeight: '500', paddingVertical: space.md },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  fab: { position: 'absolute', right: space.xl, bottom: space.xl, width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});

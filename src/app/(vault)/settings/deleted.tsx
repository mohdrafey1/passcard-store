import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState, Monogram } from '@/components/ui/Layout';
import { showToast } from '@/components/ui/Toast';
import { useCardStore } from '@/features/cards/store';
import { usePasswordStore } from '@/features/passwords/store';
import { RECENTLY_DELETED_DAYS } from '@/features/session/session';
import { cardItem, daysSince, loginItem, type VaultItem } from '@/features/vault/items';
import { cardRepository } from '@/storage/card-repository';
import { passwordRepository } from '@/storage/password-repository';
import { space, useTheme } from '@/theme';

type DeletedItem = VaultItem & { deletedAt: string };

async function fetchDeleted(): Promise<DeletedItem[]> {
  const [logins, cards] = await Promise.all([passwordRepository.findDeleted(), cardRepository.findDeleted()]);
  const all: DeletedItem[] = [
    ...logins.map((p) => ({ ...loginItem(p), deletedAt: p.deletedAt })),
    ...cards.map((cd) => ({ ...cardItem(cd), deletedAt: cd.deletedAt })),
  ];
  return all.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export default function RecentlyDeletedScreen() {
  const c = useTheme();
  const [items, setItems] = useState<DeletedItem[] | null>(null);

  const load = useCallback(() => fetchDeleted().then(setItems), []);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (item: DeletedItem) => {
    if (item.kind === 'login') await usePasswordStore.getState().restore(item.id);
    else await useCardStore.getState().restore(item.id);
    showToast(`“${item.title}” restored`);
    load();
  };

  const remove = (item: DeletedItem) =>
    Alert.alert('Delete forever?', `“${item.title}” will be gone for good.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await (item.kind === 'login' ? passwordRepository : cardRepository).hardDelete(item.id);
          load();
        },
      },
    ]);

  const emptyAll = () =>
    Alert.alert('Empty Recently deleted?', 'Every item here is deleted for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Empty',
        style: 'destructive',
        onPress: async () => {
          await Promise.all([passwordRepository.purgeDeleted(), cardRepository.purgeDeleted()]);
          load();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            items && items.length ? (
              <Button label="Empty" variant="quiet" onPress={emptyAll} style={{ minHeight: 40, paddingHorizontal: space.md }} />
            ) : null,
        }}
      />
      <FlatList
        data={items ?? []}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={{ paddingBottom: space.huge }}
        ListHeaderComponent={
          items && items.length ? (
            <AppText variant="caption" tone="muted" style={styles.note}>
              Items are deleted for good {RECENTLY_DELETED_DAYS} days after you delete them.
            </AppText>
          ) : null
        }
        ListEmptyComponent={
          items ? (
            <EmptyState
              icon="trash-2"
              title="Nothing here"
              body="Deleted logins and cards stay here for 30 days, so you can bring them back."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const left = RECENTLY_DELETED_DAYS - (daysSince(item.deletedAt) ?? 0);
          return (
            <View style={[styles.row, { borderBottomColor: c.divider }]}>
              <Monogram name={item.title} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.title}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {left <= 1 ? 'Deleted for good tomorrow' : `${left} days left`}
                </AppText>
              </View>
              <IconButton icon="rotate-ccw" label={`Restore ${item.title}`} tone="brass" onPress={() => void restore(item)} />
              <IconButton icon="trash-2" label={`Delete ${item.title} forever`} tone="danger" onPress={() => remove(item)} />
            </View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: space.xl, paddingVertical: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.xl,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
  },
});

import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { showToast, useToast } from '@/components/ui/Toast';
import { useCardStore } from '@/features/cards/store';
import { usePasswordStore } from '@/features/passwords/store';
import { useSettingsStore } from '@/features/settings/store';
import { copyToClipboard } from '@/utils/clipboard';

type ItemRef = { kind: 'login' | 'card'; id: string };

/**
 * Copy a secret, schedule the clipboard clear, confirm with a toast, and
 * stamp the item as used (for "Recently used" sorting).
 */
export function useCopySecret() {
  const seconds = useSettingsStore((s) => s.clipboardClearDuration);
  return useCallback(
    async (value: string, what: string, item?: ItemRef) => {
      if (!value) {
        showToast(`No ${what.toLowerCase()} saved`);
        return;
      }
      await copyToClipboard(value, seconds);
      Haptics.selectionAsync().catch(() => {});
      showToast(`${what} copied`, `clears in ${seconds}s`);
      if (item) {
        const markUsed = item.kind === 'login' ? usePasswordStore.getState().markUsed : useCardStore.getState().markUsed;
        markUsed(item.id).catch(() => {});
      }
    },
    [seconds],
  );
}

export async function toggleFavorite(item: ItemRef): Promise<void> {
  if (item.kind === 'login') await usePasswordStore.getState().toggleFavorite(item.id);
  else await useCardStore.getState().toggleFavorite(item.id);
}

/** Move to Recently deleted, with an Undo on the toast. */
export async function deleteWithUndo(item: ItemRef, title: string): Promise<void> {
  const store = item.kind === 'login' ? usePasswordStore.getState() : useCardStore.getState();
  await store.remove(item.id);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  useToast.getState().show({
    title: `“${title}” moved to Recently deleted`,
    action: { label: 'Undo', onPress: () => void store.restore(item.id) },
  });
}

// ---- Generator → form hand-off ----

interface GeneratorBridge {
  /** A value chosen in the generator, waiting for the form to pick it up. */
  pending: string | null;
  deliver: (value: string) => void;
  take: () => string | null;
}

export const useGeneratorBridge = create<GeneratorBridge>((set, get) => ({
  pending: null,
  deliver: (value) => set({ pending: value }),
  take: () => {
    const value = get().pending;
    if (value !== null) set({ pending: null });
    return value;
  },
}));

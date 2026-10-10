import { create } from 'zustand';
import type { CardEntry, CardFormData } from '@/types/card';
import { cardRepository } from '@/storage/card-repository';

interface CardState {
  cards: CardEntry[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (data: CardFormData) => Promise<CardEntry>;
  update: (id: string, data: Partial<CardFormData>) => Promise<CardEntry>;
  toggleFavorite: (id: string) => Promise<void>;
  markUsed: (id: string) => Promise<void>;
  /** Moves to Recently deleted. */
  remove: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  /** Drop decrypted data from memory (on lock). */
  reset: () => void;
}

const replace = (list: CardEntry[], entry: CardEntry) => list.map((c) => (c.id === entry.id ? entry : c));

export const useCardStore = create<CardState>((set, get) => ({
  cards: [],
  loaded: false,

  load: async () => {
    const cards = await cardRepository.findAll();
    set({ cards, loaded: true });
  },

  add: async (data) => {
    const entry = await cardRepository.create(data);
    set((s) => ({ cards: [entry, ...s.cards] }));
    return entry;
  },

  update: async (id, data) => {
    const updated = await cardRepository.update(id, data);
    set((s) => ({ cards: replace(s.cards, updated).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }));
    return updated;
  },

  toggleFavorite: async (id) => {
    const current = get().cards.find((c) => c.id === id);
    if (!current) return;
    const updated = await cardRepository.update(id, { favorite: !current.favorite }, { touch: false });
    set((s) => ({ cards: replace(s.cards, updated) }));
  },

  markUsed: async (id) => {
    const updated = await cardRepository.update(id, { lastUsedAt: new Date().toISOString() }, { touch: false });
    set((s) => ({ cards: replace(s.cards, updated) }));
  },

  remove: async (id) => {
    await cardRepository.softDelete(id);
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
  },

  restore: async (id) => {
    await cardRepository.restore(id);
    await get().load();
  },

  reset: () => set({ cards: [], loaded: false }),
}));

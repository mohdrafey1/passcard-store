import { create } from 'zustand';
import type { CardEntry, CardFormData } from '@/types/card';
import { cardRepository } from '@/storage/card-repository';

interface CardState {
  cards: CardEntry[];
  loading: boolean;
  searchQuery: string;
  // Actions
  load: () => Promise<void>;
  add: (data: CardFormData) => Promise<CardEntry>;
  update: (id: string, data: Partial<CardEntry>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  getFiltered: () => CardEntry[];
}

export const useCardStore = create<CardState>((set, get) => ({
  cards: [],
  loading: false,
  searchQuery: '',

  load: async () => {
    set({ loading: true });
    try {
      const cards = await cardRepository.findAll();
      set({ cards, loading: false });
    } catch (error) {
      console.error('Failed to load cards:', error);
      set({ loading: false });
    }
  },

  add: async (data: CardFormData) => {
    const entry = await cardRepository.create(data);
    set((state) => ({ cards: [entry, ...state.cards] }));
    return entry;
  },

  update: async (id: string, data: Partial<CardEntry>) => {
    const updated = await cardRepository.update(id, data);
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? updated : c)),
    }));
  },

  remove: async (id: string) => {
    await cardRepository.delete(id);
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
    }));
  },

  search: async (query: string) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      await get().load();
      return;
    }
    try {
      const results = await cardRepository.search(query.toLowerCase(), [
        'search_nickname',
        'search_last_four',
        'search_holder_name',
      ]);
      set({ cards: results });
    } catch (error) {
      console.error('Failed to search cards:', error);
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  getFiltered: () => {
    const { cards, searchQuery } = get();
    if (!searchQuery.trim()) return cards;

    const q = searchQuery.toLowerCase();
    return cards.filter(
      (c) =>
        c.cardNickname.toLowerCase().includes(q) ||
        c.cardHolderName.toLowerCase().includes(q) ||
        c.cardNumber.slice(-4).includes(q),
    );
  },
}));

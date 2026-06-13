import { create } from 'zustand';
import type { PasswordEntry, PasswordCategory, PasswordFormData } from '@/types/password';
import { passwordRepository } from '@/storage/password-repository';

interface PasswordState {
  passwords: PasswordEntry[];
  loading: boolean;
  searchQuery: string;
  selectedCategory: PasswordCategory | 'All';
  // Actions
  load: () => Promise<void>;
  add: (data: PasswordFormData) => Promise<PasswordEntry>;
  update: (id: string, data: Partial<PasswordEntry>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<PasswordEntry | null>;
  search: (query: string) => Promise<void>;
  setCategory: (category: PasswordCategory | 'All') => void;
  setSearchQuery: (query: string) => void;
  getFiltered: () => PasswordEntry[];
}

export const usePasswordStore = create<PasswordState>((set, get) => ({
  passwords: [],
  loading: false,
  searchQuery: '',
  selectedCategory: 'All',

  load: async () => {
    set({ loading: true });
    try {
      const passwords = await passwordRepository.findAll();
      set({ passwords, loading: false });
    } catch (error) {
      console.error('Failed to load passwords:', error);
      set({ loading: false });
    }
  },

  add: async (data: PasswordFormData) => {
    const entry = await passwordRepository.create(data);
    set((state) => ({ passwords: [entry, ...state.passwords] }));
    return entry;
  },

  update: async (id: string, data: Partial<PasswordEntry>) => {
    const updated = await passwordRepository.update(id, data);
    set((state) => ({
      passwords: state.passwords.map((p) => (p.id === id ? updated : p)),
    }));
  },

  remove: async (id: string) => {
    await passwordRepository.delete(id);
    set((state) => ({
      passwords: state.passwords.filter((p) => p.id !== id),
    }));
  },

  duplicate: async (id: string) => {
    const original = await passwordRepository.findById(id);
    if (!original) return null;
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = original;
    const duplicated = await passwordRepository.create({
      ...data,
      title: `${data.title} (copy)`,
    });
    set((state) => ({ passwords: [duplicated, ...state.passwords] }));
    return duplicated;
  },

  search: async (query: string) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      await get().load();
      return;
    }
    try {
      const results = await passwordRepository.search(query.toLowerCase(), [
        'search_title',
        'search_website',
        'search_email',
        'search_username',
      ]);
      set({ passwords: results });
    } catch (error) {
      console.error('Failed to search passwords:', error);
    }
  },

  setCategory: (category: PasswordCategory | 'All') => {
    set({ selectedCategory: category });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  getFiltered: () => {
    const { passwords, selectedCategory, searchQuery } = get();
    let filtered = passwords;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.website.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.username.toLowerCase().includes(q),
      );
    }

    return filtered;
  },
}));

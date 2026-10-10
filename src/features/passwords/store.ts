import { create } from 'zustand';
import type { PasswordEntry, PasswordFormData } from '@/types/password';
import { passwordRepository } from '@/storage/password-repository';

interface PasswordState {
  passwords: PasswordEntry[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (data: PasswordFormData) => Promise<PasswordEntry>;
  update: (id: string, data: Partial<PasswordFormData>) => Promise<PasswordEntry>;
  toggleFavorite: (id: string) => Promise<void>;
  markUsed: (id: string) => Promise<void>;
  /** Moves to Recently deleted. */
  remove: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<PasswordEntry | null>;
  /** Drop decrypted data from memory (on lock). */
  reset: () => void;
}

const replace = (list: PasswordEntry[], entry: PasswordEntry) =>
  list.map((p) => (p.id === entry.id ? entry : p));

export const usePasswordStore = create<PasswordState>((set, get) => ({
  passwords: [],
  loaded: false,

  load: async () => {
    const passwords = await passwordRepository.findAll();
    set({ passwords, loaded: true });
  },

  add: async (data) => {
    const entry = await passwordRepository.create({
      ...data,
      passwordChangedAt: data.passwordChangedAt ?? new Date().toISOString(),
    });
    set((s) => ({ passwords: [entry, ...s.passwords] }));
    return entry;
  },

  update: async (id, data) => {
    const current = get().passwords.find((p) => p.id === id);
    const passwordChanged = data.password !== undefined && current && data.password !== current.password;
    const updated = await passwordRepository.update(id, {
      ...data,
      ...(passwordChanged ? { passwordChangedAt: new Date().toISOString() } : {}),
    });
    set((s) => ({ passwords: replace(s.passwords, updated).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }));
    return updated;
  },

  toggleFavorite: async (id) => {
    const current = get().passwords.find((p) => p.id === id);
    if (!current) return;
    const updated = await passwordRepository.update(id, { favorite: !current.favorite }, { touch: false });
    set((s) => ({ passwords: replace(s.passwords, updated) }));
  },

  markUsed: async (id) => {
    const updated = await passwordRepository.update(id, { lastUsedAt: new Date().toISOString() }, { touch: false });
    set((s) => ({ passwords: replace(s.passwords, updated) }));
  },

  remove: async (id) => {
    await passwordRepository.softDelete(id);
    set((s) => ({ passwords: s.passwords.filter((p) => p.id !== id) }));
  },

  restore: async (id) => {
    await passwordRepository.restore(id);
    await get().load();
  },

  duplicate: async (id) => {
    const original = get().passwords.find((p) => p.id === id);
    if (!original) return null;
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = original;
    return get().add({ ...data, title: `${data.title} (copy)`, favorite: false, lastUsedAt: null });
  },

  reset: () => set({ passwords: [], loaded: false }),
}));

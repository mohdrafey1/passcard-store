import { EncryptedRepository } from './encrypted-repository';
import type { PasswordEntry } from '@/types/password';

export const passwordRepository = new EncryptedRepository<PasswordEntry>(
  'passwords',
  (item) => ({
    search_title: item.title.toLowerCase(),
    search_website: item.website.toLowerCase(),
    search_email: item.email.toLowerCase(),
    search_username: item.username.toLowerCase(),
    category: item.category,
  }),
);

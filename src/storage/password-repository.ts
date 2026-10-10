import { EncryptedRepository } from './encrypted-repository';
import { normalizePassword, type PasswordEntry } from '@/types/password';

export const passwordRepository = new EncryptedRepository<PasswordEntry>('passwords', normalizePassword);

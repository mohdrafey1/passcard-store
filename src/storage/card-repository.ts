import { EncryptedRepository } from './encrypted-repository';
import { normalizeCard, type CardEntry } from '@/types/card';

export const cardRepository = new EncryptedRepository<CardEntry>('cards', normalizeCard);

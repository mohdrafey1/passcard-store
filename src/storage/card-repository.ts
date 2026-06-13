import { EncryptedRepository } from './encrypted-repository';
import type { CardEntry } from '@/types/card';

export const cardRepository = new EncryptedRepository<CardEntry>(
  'cards',
  (item) => ({
    search_nickname: item.cardNickname.toLowerCase(),
    search_last_four: item.cardNumber.slice(-4),
    search_holder_name: item.cardHolderName.toLowerCase(),
  }),
);

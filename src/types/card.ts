export interface CardEntry {
  id: string;
  cardHolderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardNickname: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type CardFormData = Omit<CardEntry, 'id' | 'createdAt' | 'updatedAt'>;

export type PasswordCategory =
  | 'Social'
  | 'Banking'
  | 'Work'
  | 'Personal'
  | 'Shopping'
  | 'Entertainment'
  | 'Education'
  | 'Other';

export interface PasswordEntry {
  id: string;
  title: string;
  website: string;
  username: string;
  email: string;
  password: string;
  notes: string;
  category: PasswordCategory;
  createdAt: string;
  updatedAt: string;
}

export type PasswordFormData = Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>;

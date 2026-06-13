import { getDatabase } from './database';
import { encrypt, decrypt, getEncryptionKey } from '@/security/encryption';
import * as ExpoCrypto from 'expo-crypto';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface SearchFieldExtractor<T> {
  (item: T): Record<string, string>;
}

/**
 * Generic encrypted repository that stores data in SQLite
 * Sensitive data is AES-256 encrypted in the encrypted_data column
 * Non-sensitive search fields are stored as plaintext for fast querying
 */
export class EncryptedRepository<T extends BaseEntity> {
  constructor(
    private tableName: string,
    private searchFieldExtractor: SearchFieldExtractor<T>,
  ) {}

  private async getKey(): Promise<string> {
    const key = await getEncryptionKey();
    if (!key) {
      throw new Error('Encryption key not found. Please set up PIN first.');
    }
    return key;
  }

  /**
   * Create a new record
   */
  async create(item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const db = await getDatabase();
    const key = await this.getKey();
    const now = new Date().toISOString();

    const record = {
      ...item,
      id: ExpoCrypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as T;

    const encryptedData = encrypt(JSON.stringify(record), key);
    const searchFields = this.searchFieldExtractor(record);

    const columns = ['id', 'encrypted_data', 'created_at', 'updated_at', ...Object.keys(searchFields)];
    const placeholders = columns.map(() => '?').join(', ');
    const values = [
      record.id,
      encryptedData,
      now,
      now,
      ...Object.values(searchFields),
    ];

    await db.runAsync(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      values,
    );

    return record;
  }

  /**
   * Update an existing record
   */
  async update(id: string, updates: Partial<T>): Promise<T> {
    const db = await getDatabase();
    const key = await this.getKey();
    const existing = await this.findById(id);

    if (!existing) {
      throw new Error(`Record with id ${id} not found`);
    }

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      ...updates,
      id, // prevent id change
      updatedAt: now,
    } as T;

    const encryptedData = encrypt(JSON.stringify(updated), key);
    const searchFields = this.searchFieldExtractor(updated);

    const setClauses = [
      'encrypted_data = ?',
      'updated_at = ?',
      ...Object.keys(searchFields).map((k) => `${k} = ?`),
    ];
    const values = [
      encryptedData,
      now,
      ...Object.values(searchFields),
      id,
    ];

    await db.runAsync(
      `UPDATE ${this.tableName} SET ${setClauses.join(', ')} WHERE id = ?`,
      values,
    );

    return updated;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<T | null> {
    const db = await getDatabase();
    const key = await this.getKey();

    const row = await db.getFirstAsync<{ encrypted_data: string }>(
      `SELECT encrypted_data FROM ${this.tableName} WHERE id = ?`,
      [id],
    );

    if (!row) return null;

    const decrypted = decrypt(row.encrypted_data, key);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Get all records, ordered by most recently updated
   */
  async findAll(): Promise<T[]> {
    const db = await getDatabase();
    const key = await this.getKey();

    const rows = await db.getAllAsync<{ encrypted_data: string }>(
      `SELECT encrypted_data FROM ${this.tableName} ORDER BY updated_at DESC`,
    );

    return rows.map((row) => {
      const decrypted = decrypt(row.encrypted_data, key);
      return JSON.parse(decrypted) as T;
    });
  }

  /**
   * Search records by query across search index columns
   */
  async search(query: string, searchColumns: string[]): Promise<T[]> {
    const db = await getDatabase();
    const key = await this.getKey();

    const conditions = searchColumns.map((col) => `${col} LIKE ?`).join(' OR ');
    const params = searchColumns.map(() => `%${query}%`);

    const rows = await db.getAllAsync<{ encrypted_data: string }>(
      `SELECT encrypted_data FROM ${this.tableName} WHERE ${conditions} ORDER BY updated_at DESC`,
      params,
    );

    return rows.map((row) => {
      const decrypted = decrypt(row.encrypted_data, key);
      return JSON.parse(decrypted) as T;
    });
  }

  /**
   * Get total record count
   */
  async count(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`,
    );
    return result?.count ?? 0;
  }

  /**
   * Delete all records
   */
  async deleteAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${this.tableName}`);
  }

  /**
   * Get recently added records (limit N)
   */
  async getRecent(limit: number): Promise<T[]> {
    const db = await getDatabase();
    const key = await this.getKey();

    const rows = await db.getAllAsync<{ encrypted_data: string }>(
      `SELECT encrypted_data FROM ${this.tableName} ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );

    return rows.map((row) => {
      const decrypted = decrypt(row.encrypted_data, key);
      return JSON.parse(decrypted) as T;
    });
  }

  /**
   * Bulk insert records (for import/restore)
   */
  async bulkCreate(items: T[]): Promise<void> {
    const db = await getDatabase();
    const key = await this.getKey();

    await db.withTransactionAsync(async () => {
      for (const item of items) {
        const encryptedData = encrypt(JSON.stringify(item), key);
        const searchFields = this.searchFieldExtractor(item);

        const columns = ['id', 'encrypted_data', 'created_at', 'updated_at', ...Object.keys(searchFields)];
        const placeholders = columns.map(() => '?').join(', ');
        const values = [
          item.id,
          encryptedData,
          item.createdAt,
          item.updatedAt,
          ...Object.values(searchFields),
        ];

        await db.runAsync(
          `INSERT OR REPLACE INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
          values,
        );
      }
    });
  }

  /**
   * Filter records by a specific column value
   */
  async filterBy(column: string, value: string): Promise<T[]> {
    const db = await getDatabase();
    const key = await this.getKey();

    const rows = await db.getAllAsync<{ encrypted_data: string }>(
      `SELECT encrypted_data FROM ${this.tableName} WHERE ${column} = ? ORDER BY updated_at DESC`,
      [value],
    );

    return rows.map((row) => {
      const decrypted = decrypt(row.encrypted_data, key);
      return JSON.parse(decrypted) as T;
    });
  }
}

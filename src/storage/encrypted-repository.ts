import * as ExpoCrypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';
import { decryptRecord, encryptRecord, isCurrentFormat } from '@/security/encryption';
import { getSession } from '@/security/key-manager';
import { legacyDecrypt } from '@/security/legacy';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type Deleted<T> = T & { deletedAt: string };

type Table = 'passwords' | 'cards';

/** Plaintext search columns written by v1.0–v1.1; blanked during migration. */
const LEGACY_SEARCH_COLUMNS: Record<Table, string[]> = {
  passwords: ['search_title', 'search_website', 'search_email', 'search_username', 'category'],
  cards: ['search_nickname', 'search_last_four', 'search_holder_name'],
};

interface Row {
  id: string;
  encrypted_data: string;
  deleted_at?: string | null;
}

/**
 * SQLite repository where each row's content is one AES-256-GCM sealed JSON
 * document. Only the id and timestamps are stored in the clear; search and
 * filtering happen in memory on decrypted data.
 *
 * Deleting is soft: rows get `deleted_at` and show in Recently deleted until
 * purged after 30 days.
 */
export class EncryptedRepository<T extends BaseEntity> {
  /** Rows that failed to decrypt on the last read; surfaced instead of crashing. */
  unreadable = 0;

  constructor(
    private table: Table,
    private normalize: (raw: unknown) => T | null,
  ) {}

  private aad(id: string): string {
    return `${this.table}:${id}`;
  }

  private async decryptRows(rows: Row[]): Promise<T[]> {
    let unreadable = 0;
    const items: (T | null)[] = await Promise.all(
      rows.map(async (row): Promise<T | null> => {
        try {
          const item = this.normalize(JSON.parse(await decryptRecord(row.encrypted_data, this.aad(row.id))));
          if (!item) unreadable++;
          return item;
        } catch {
          unreadable++;
          return null;
        }
      }),
    );
    this.unreadable = unreadable;
    return items.filter((x): x is T => x !== null);
  }

  async findAll(): Promise<T[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `SELECT id, encrypted_data FROM ${this.table} WHERE deleted_at IS NULL ORDER BY updated_at DESC`,
    );
    return this.decryptRows(rows);
  }

  async findDeleted(): Promise<Deleted<T>[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `SELECT id, encrypted_data, deleted_at FROM ${this.table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
    );
    const deletedAt = new Map(rows.map((r) => [r.id, r.deleted_at as string]));
    const items = await this.decryptRows(rows);
    return items.map((item) => ({ ...item, deletedAt: deletedAt.get(item.id) as string }));
  }

  async findById(id: string): Promise<T | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>(`SELECT id, encrypted_data FROM ${this.table} WHERE id = ?`, [id]);
    if (!row) return null;
    const [item] = await this.decryptRows([row]);
    return item ?? null;
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString();
    const record = { ...data, id: ExpoCrypto.randomUUID(), createdAt: now, updatedAt: now } as T;
    await this.write(await getDatabase(), record);
    return record;
  }

  /**
   * Update a record. `touch: false` keeps `updatedAt` (favourite toggles and
   * "last used" stamps shouldn't count as edits).
   */
  async update(id: string, patch: Partial<T>, { touch = true }: { touch?: boolean } = {}): Promise<T> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('This item no longer exists.');
    const updated = {
      ...existing,
      ...patch,
      id,
      createdAt: existing.createdAt,
      updatedAt: touch ? new Date().toISOString() : existing.updatedAt,
    } as T;
    const db = await getDatabase();
    const sealed = await encryptRecord(JSON.stringify(updated), this.aad(id));
    await db.runAsync(`UPDATE ${this.table} SET encrypted_data = ?, updated_at = ? WHERE id = ?`, [
      sealed,
      updated.updatedAt,
      id,
    ]);
    return updated;
  }

  /** Insert or replace, keeping the record's own timestamps (import/restore). */
  private async write(db: SQLiteDatabase, record: T): Promise<void> {
    const sealed = await encryptRecord(JSON.stringify(record), this.aad(record.id));
    await db.runAsync(
      `INSERT OR REPLACE INTO ${this.table} (id, encrypted_data, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, NULL)`,
      [record.id, sealed, record.createdAt, record.updatedAt],
    );
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`UPDATE ${this.table} SET deleted_at = ? WHERE id = ?`, [new Date().toISOString(), id]);
  }

  async restore(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`UPDATE ${this.table} SET deleted_at = NULL WHERE id = ?`, [id]);
  }

  async hardDelete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
  }

  async purgeDeleted(olderThan?: Date): Promise<void> {
    const db = await getDatabase();
    if (olderThan) {
      await db.runAsync(`DELETE FROM ${this.table} WHERE deleted_at IS NOT NULL AND deleted_at < ?`, [
        olderThan.toISOString(),
      ]);
    } else {
      await db.runAsync(`DELETE FROM ${this.table} WHERE deleted_at IS NOT NULL`);
    }
  }

  async countDeleted(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.table} WHERE deleted_at IS NOT NULL`,
    );
    return result?.count ?? 0;
  }

  async count(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.table} WHERE deleted_at IS NULL`,
    );
    return result?.count ?? 0;
  }

  /**
   * Seal records first (async native calls), then write them in one
   * transaction. Pass `db` to join a caller's transaction instead.
   */
  async upsertMany(items: T[]): Promise<void> {
    const db = await getDatabase();
    const sealed = await Promise.all(
      items.map(async (item) => ({ item, data: await encryptRecord(JSON.stringify(item), this.aad(item.id)) })),
    );
    await db.withTransactionAsync(async () => {
      for (const { item, data } of sealed) {
        await db.runAsync(
          `INSERT OR REPLACE INTO ${this.table} (id, encrypted_data, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, NULL)`,
          [item.id, data, item.createdAt, item.updatedAt],
        );
      }
    });
  }

  /** Pre-seal records for `writeSealedTx` so a multi-table transaction stays short. */
  async sealMany(items: T[]): Promise<{ item: T; data: string }[]> {
    return Promise.all(
      items.map(async (item) => ({ item, data: await encryptRecord(JSON.stringify(item), this.aad(item.id)) })),
    );
  }

  async writeSealedTx(db: SQLiteDatabase, sealed: { item: T; data: string }[]): Promise<void> {
    for (const { item, data } of sealed) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${this.table} (id, encrypted_data, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, NULL)`,
        [item.id, data, item.createdAt, item.updatedAt],
      );
    }
  }

  async deleteAllTx(db: SQLiteDatabase): Promise<void> {
    await db.runAsync(`DELETE FROM ${this.table}`);
  }

  /**
   * Rewrite v1.0–v1.1 rows (AES-CBC, plaintext search columns) in the current
   * format. Runs after every unlock; does nothing once all rows are current.
   * Rows that can't be read are left untouched rather than lost.
   */
  async migrateLegacyRows(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `SELECT id, encrypted_data FROM ${this.table} WHERE encrypted_data NOT LIKE 'g1:%'`,
    );
    const blankColumns = LEGACY_SEARCH_COLUMNS[this.table].map((c) => `${c} = ''`).join(', ');
    if (rows.length === 0) {
      // Earlier partial runs may have re-sealed rows; make sure no plaintext
      // search data remains either way.
      await db.runAsync(`UPDATE ${this.table} SET ${blankColumns} WHERE ${LEGACY_SEARCH_COLUMNS[this.table]
        .map((c) => `${c} != ''`)
        .join(' OR ')}`);
      return 0;
    }

    const { keyHex } = getSession();
    const rewritten: { id: string; data: string }[] = [];
    for (const row of rows) {
      if (isCurrentFormat(row.encrypted_data)) continue;
      let json = '';
      try {
        json = legacyDecrypt(row.encrypted_data, keyHex);
        JSON.parse(json);
      } catch {
        continue;
      }
      rewritten.push({ id: row.id, data: await encryptRecord(json, this.aad(row.id)) });
    }

    await db.withTransactionAsync(async () => {
      for (const { id, data } of rewritten) {
        await db.runAsync(`UPDATE ${this.table} SET encrypted_data = ? WHERE id = ?`, [data, id]);
      }
      await db.runAsync(`UPDATE ${this.table} SET ${blankColumns}`);
    });
    return rewritten.length;
  }
}

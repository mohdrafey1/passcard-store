import * as SQLite from 'expo-sqlite';

const DB_NAME = 'passcard_vault.db';
const SCHEMA_VERSION = 2;

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Get the database instance, creating it if needed.
 * Uses a promise lock to prevent race conditions during initialization.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const database = await SQLite.openDatabaseAsync(DB_NAME);
    await migrate(database);
    db = database;
    return database;
  })();

  try {
    return await dbPromise;
  } catch (error) {
    dbPromise = null;
    throw error;
  }
}

async function hasColumn(database: SQLite.SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const cols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}

/**
 * Schema history (tracked in PRAGMA user_version):
 *  1 — v1.0–v1.1 tables, with plaintext search columns.
 *  2 — v1.3: `deleted_at` for Recently deleted; search columns are no longer
 *      written (search runs in memory on decrypted data) and their indexes go.
 */
async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');

  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  // The legacy column set is kept so existing installs and new ones share
  // one shape; the search_* columns simply stay empty from v2 on.
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS passwords (
      id TEXT PRIMARY KEY NOT NULL,
      encrypted_data TEXT NOT NULL,
      search_title TEXT DEFAULT '',
      search_website TEXT DEFAULT '',
      search_email TEXT DEFAULT '',
      search_username TEXT DEFAULT '',
      category TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY NOT NULL,
      encrypted_data TEXT NOT NULL,
      search_nickname TEXT DEFAULT '',
      search_last_four TEXT DEFAULT '',
      search_holder_name TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  for (const table of ['passwords', 'cards']) {
    if (!(await hasColumn(database, table, 'deleted_at'))) {
      await database.execAsync(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT DEFAULT NULL;`);
    }
  }

  await database.execAsync(`
    DROP INDEX IF EXISTS idx_passwords_category;
    DROP INDEX IF EXISTS idx_passwords_search;
    DROP INDEX IF EXISTS idx_cards_search;
    CREATE INDEX IF NOT EXISTS idx_passwords_updated ON passwords(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_updated ON cards(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_passwords_deleted ON passwords(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at);
  `);

  await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

/**
 * Delete the database (used during full data wipe)
 */
export async function deleteDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    dbPromise = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
}

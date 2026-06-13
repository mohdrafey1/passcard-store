import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Get the database instance, creating it if needed.
 * Uses a promise lock to prevent race conditions during initialization.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  // If init is already in progress, wait for it
  if (dbPromise) return dbPromise;

  // Start init and store the promise so concurrent callers wait on it
  dbPromise = (async () => {
    const database = await SQLite.openDatabaseAsync('passcard_vault.db');
    await initializeSchema(database);
    db = database;
    return database;
  })();

  try {
    return await dbPromise;
  } catch (error) {
    // Reset on failure so next call retries
    dbPromise = null;
    throw error;
  }
}

/**
 * Initialize the database schema
 */
async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  // Execute PRAGMAs separately — some drivers don't support multi-statement PRAGMAs
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS passwords (
      id TEXT PRIMARY KEY NOT NULL,
      encrypted_data TEXT NOT NULL,
      search_title TEXT DEFAULT '',
      search_website TEXT DEFAULT '',
      search_email TEXT DEFAULT '',
      search_username TEXT DEFAULT '',
      category TEXT DEFAULT 'Other',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await database.execAsync(`
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

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_passwords_category ON passwords(category);
    CREATE INDEX IF NOT EXISTS idx_passwords_search ON passwords(search_title, search_website, search_email);
    CREATE INDEX IF NOT EXISTS idx_cards_search ON cards(search_nickname, search_last_four);
    CREATE INDEX IF NOT EXISTS idx_passwords_updated ON passwords(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cards_updated ON cards(updated_at DESC);
  `);
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    dbPromise = null;
  }
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
  await SQLite.deleteDatabaseAsync('passcard_vault.db');
}

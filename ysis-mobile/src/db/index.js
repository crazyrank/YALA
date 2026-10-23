import * as SQLite from 'expo-sqlite';
import { SCHEMA_STATEMENTS, DEVICE_META_KEYS } from './schema';

// Staged student imports. Holds student rows until the server confirms them, then deletes them.
const STAGED_IMPORTS_STATEMENT = `CREATE TABLE IF NOT EXISTS staged_imports (
  import_key        TEXT PRIMARY KEY,
  file_name         TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('staged','uploading','completed','failed')),
  ready_count       INTEGER NOT NULL DEFAULT 0,
  local_skipped_json TEXT NOT NULL DEFAULT '[]',
  rows_json         TEXT NOT NULL DEFAULT '',
  server_result_json TEXT,
  error_code        TEXT,
  last_attempt_at   TEXT
);`;

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('ysis.db');
  for (const statement of SCHEMA_STATEMENTS) {
    // eslint-disable-next-line no-await-in-loop
    await dbInstance.execAsync(statement);
  }
  await dbInstance.execAsync(STAGED_IMPORTS_STATEMENT);
  await runColumnMigrations(dbInstance);
  return dbInstance;
}

async function runColumnMigrations(db) {
  const columnMigrations = [
    `ALTER TABLE sync_operations ADD COLUMN error_code TEXT`,
    `ALTER TABLE sync_operations ADD COLUMN error_message TEXT`,
    `ALTER TABLE students ADD COLUMN academic_session TEXT`,
  ];
  for (const statement of columnMigrations) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.execAsync(statement);
    } catch (err) {
      if (!/duplicate column name/i.test(err?.message || '')) {
        throw err;
      }
    }
  }
}

export async function getMeta(key) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT value FROM device_meta WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function setMeta(key, value) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO device_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function getNextSequenceNo() {
  const current = await getMeta(DEVICE_META_KEYS.NEXT_SEQUENCE_NO);
  const next = current ? parseInt(current, 10) + 1 : 1;
  await setMeta(DEVICE_META_KEYS.NEXT_SEQUENCE_NO, String(next));
  return next;
}

// Called on logout. Clears staged student rows along with everything else.
export async function wipeLocalData() {
  const database = await getDb();
  const tables = ['students', 'student_photos', 'sync_operations', 'notifications_cache', 'staged_imports'];
  for (const table of tables) {
    // eslint-disable-next-line no-await-in-loop
    await database.runAsync(`DELETE FROM ${table}`);
  }
}

export { DEVICE_META_KEYS };

import * as SQLite from 'expo-sqlite';
import { SCHEMA_STATEMENTS, DEVICE_META_KEYS } from './schema';
import { studentsRebuildSql } from './studentsTableRebuild';
import { applySlice1Migrations } from './slice1Migrations';

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

// Callers wait for the whole setup (including the one-time students table rebuild)
// before they get the connection, so nothing can query a half-rebuilt table.
let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = initDb().catch((err) => {
      dbPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return dbPromise;
}

async function initDb() {
  const db = await SQLite.openDatabaseAsync('ysis.db');
  for (const statement of SCHEMA_STATEMENTS) {
    // eslint-disable-next-line no-await-in-loop
    await db.execAsync(statement);
  }
  await db.execAsync(STAGED_IMPORTS_STATEMENT);
  await runColumnMigrations(db);
  await applySlice1Migrations(db);
  await rebuildStudentsTableIfNeeded(db);
  return db;
}

// One-time: widen the status CHECK on phones that still have the old 8-status table.
// Copies every row. If anything fails, the transaction rolls back and the old table stays.
async function rebuildStudentsTableIfNeeded(db) {
  const row = await db.getFirstAsync("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'students'");
  const createSql = studentsRebuildSql(row?.sql);
  if (!createSql) return;
  const info = await db.getAllAsync('PRAGMA table_info(students)');
  const cols = info.map((c) => `"${c.name}"`).join(', ');
  await db.execAsync('DROP TABLE IF EXISTS students_rebuild');
  await db.withTransactionAsync(async () => {
    await db.execAsync(createSql);
    await db.execAsync(`INSERT INTO students_rebuild (${cols}) SELECT ${cols} FROM students`);
    await db.execAsync('DROP TABLE students');
    await db.execAsync('ALTER TABLE students_rebuild RENAME TO students');
  });
}

async function runColumnMigrations(db) {
  const columnMigrations = [
    `ALTER TABLE sync_operations ADD COLUMN error_code TEXT`,
    `ALTER TABLE sync_operations ADD COLUMN error_message TEXT`,
    `ALTER TABLE students ADD COLUMN academic_session TEXT`,
    `ALTER TABLE students ADD COLUMN current_session TEXT`,
    `ALTER TABLE students ADD COLUMN entrance_outcome TEXT`,
    `ALTER TABLE students ADD COLUMN approval_status TEXT`,
    `ALTER TABLE students ADD COLUMN return_reason TEXT`,
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
  const tables = ['students', 'student_photos', 'sync_operations', 'notifications_cache', 'staged_imports', 'biodata_local', 'log_entries_local'];
  for (const table of tables) {
    // eslint-disable-next-line no-await-in-loop
    await database.runAsync(`DELETE FROM ${table}`);
  }
  await database.runAsync('DELETE FROM sync_state').catch(() => {});
  await database.runAsync("DELETE FROM device_meta WHERE key LIKE 'biodata_%'");
  await database.runAsync("DELETE FROM device_meta WHERE key LIKE 'log_%'");
  await database.runAsync('DELETE FROM directory_local').catch(() => {});
  await database.runAsync('DELETE FROM staff_profiles_local').catch(() => {});
}

export { DEVICE_META_KEYS };

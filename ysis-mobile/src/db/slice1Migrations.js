/**
 * Offline database foundation.
 *  1. Widens sync_operations so it accepts every type in syncOperationTypes.js.
 *     SQLite cannot change a CHECK constraint in place, so the table is rebuilt.
 *     Every existing column is copied across (including attempts, error_code and
 *     error_message), inside one transaction.
 *  2. Creates local tables for biodata and log entries.
 * Safe to run on every start: each step checks whether it is already done.
 */
import { SYNC_OP_TYPES, SYNC_OP_TYPES_SQL } from './syncOperationTypes';

const SYNC_OPS_COLUMN_LIST = [
  'id', 'operation_id', 'op_type', 'entity_id', 'payload', 'sequence_no',
  'created_at_client', 'status', 'last_attempt_at', 'error_code', 'error_message', 'attempts',
];

const SYNC_OPS_CREATE = (name) => `CREATE TABLE ${name} (
    id                TEXT PRIMARY KEY,
    operation_id      TEXT UNIQUE NOT NULL,
    op_type           TEXT NOT NULL CHECK (op_type IN (${SYNC_OP_TYPES_SQL})),
    entity_id         TEXT NOT NULL,
    payload           TEXT NOT NULL,
    sequence_no       INTEGER NOT NULL,
    created_at_client TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','synced','conflicted','failed')),
    last_attempt_at   TEXT,
    error_code        TEXT,
    error_message     TEXT,
    attempts          INTEGER NOT NULL DEFAULT 0
  )`;

// Local copy of each student's biodata. The record is kept as JSON so the field
// list lives in one place (biodataForm.js).
const BIODATA_LOCAL_CREATE = `CREATE TABLE IF NOT EXISTS biodata_local (
    student_id      TEXT PRIMARY KEY,
    data_json       TEXT NOT NULL DEFAULT '{}',
    approval_status TEXT
      CHECK (approval_status IS NULL OR approval_status IN ('pending','approved','returned')),
    return_reason   TEXT,
    version         INTEGER NOT NULL DEFAULT 1,
    updated_at      TEXT,
    local_dirty     INTEGER NOT NULL DEFAULT 0
  )`;

const LOG_ENTRIES_LOCAL_CREATE = `CREATE TABLE IF NOT EXISTS log_entries_local (
    id           TEXT PRIMARY KEY,
    entry_date   TEXT NOT NULL,
    body         TEXT NOT NULL,
    author_id    TEXT,
    created_at   TEXT,
    updated_at   TEXT,
    local_dirty  INTEGER NOT NULL DEFAULT 0
  )`;

const STAFF_PROFILES_LOCAL_CREATE = `CREATE TABLE IF NOT EXISTS staff_profiles_local (
    id            TEXT PRIMARY KEY,
    data_json     TEXT NOT NULL,
    version       INTEGER NOT NULL DEFAULT 1,
    local_dirty   INTEGER NOT NULL DEFAULT 0,
    cached_at     TEXT NOT NULL
  )`;

export async function applySlice1Migrations(db) {
  await rebuildSyncOperationsIfNeeded(db);
  await db.execAsync(BIODATA_LOCAL_CREATE);
  await db.execAsync(LOG_ENTRIES_LOCAL_CREATE);
  await db.execAsync(STAFF_PROFILES_LOCAL_CREATE);
}

async function rebuildSyncOperationsIfNeeded(db) {
  const row = await db.getFirstAsync(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sync_operations'"
  );
  if (!row || !row.sql) return; // no table yet; the schema creates the current one
  // Rebuild only when the table is missing any type we now need.
  if (SYNC_OP_TYPES.every((t) => row.sql.includes(`'${t}'`))) return;

  const existing = (await db.getAllAsync('PRAGMA table_info(sync_operations)')).map((c) => c.name);
  const copied = SYNC_OPS_COLUMN_LIST.filter((c) => existing.includes(c));
  const cols = copied.join(', ');

  await db.execAsync('DROP TABLE IF EXISTS sync_operations_new');
  await db.withTransactionAsync(async () => {
    await db.execAsync(SYNC_OPS_CREATE('sync_operations_new'));
    await db.execAsync(`INSERT INTO sync_operations_new (${cols}) SELECT ${cols} FROM sync_operations`);
    await db.execAsync('DROP TABLE sync_operations');
    await db.execAsync('ALTER TABLE sync_operations_new RENAME TO sync_operations');
  });
}

// Exported so the tests can run the exact same SQL.
export const _test = { SYNC_OPS_CREATE, SYNC_OPS_COLUMN_LIST, BIODATA_LOCAL_CREATE, LOG_ENTRIES_LOCAL_CREATE, STAFF_PROFILES_LOCAL_CREATE };

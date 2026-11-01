import { getDb } from '../db';

const SCOPE_KEY = 'students_scope_key';

async function ensureStateTable(db) {
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  );
}

async function readState(db, key) {
  const row = await db.getFirstAsync('SELECT value FROM sync_state WHERE key = ?', [key]);
  return row ? row.value : null;
}

/**
 * Compares the server's scope key with the one saved on this phone.
 *
 * Returns { reset: true } when local students were cleared and the pull
 * cursor was reset, so the caller must restart the pull from the beginning.
 * Returns { reset: false } when nothing changed, or when unsent operations
 * exist and the data must be kept for now.
 */
export async function checkScopeChanged(serverScopeKey) {
  if (!serverScopeKey) return { reset: false };

  const db = await getDb();
  await ensureStateTable(db);

  const stored = await readState(db, SCOPE_KEY);
  if (stored === serverScopeKey) return { reset: false };

  // Never clear data while the phone still has changes waiting to upload.
  const unsent = await db.getFirstAsync(
    "SELECT COUNT(*) AS count FROM sync_operations WHERE status IN ('pending', 'failed')"
  );
  if ((unsent?.count || 0) > 0) return { reset: false };

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM students');
    await db.runAsync('DELETE FROM student_photos');
    await db.runAsync("DELETE FROM sync_state WHERE key = 'students_cursor'");
    await db.runAsync(
      'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [SCOPE_KEY, serverScopeKey]
    );
  });

  return { reset: true };
}

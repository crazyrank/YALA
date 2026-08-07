import * as SQLite from 'expo-sqlite';
import { SCHEMA_STATEMENTS, DEVICE_META_KEYS } from './schema';

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('ysis.db');
  for (const statement of SCHEMA_STATEMENTS) {
    // eslint-disable-next-line no-await-in-loop
    await dbInstance.execAsync(statement);
  }
  return dbInstance;
}

// --- device_meta helpers -------------------------------------------------

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

/**
 * Returns the next sequence_no for this device and persists the
 * increment immediately, so it survives app restarts. Simple integer
 * counter, NOT timestamp-derived (Build Spec Section 17 — device clocks
 * aren't trustworthy for FIFO ordering). Only resets on full reinstall,
 * since device_meta lives in the same SQLite file as everything else.
 */
export async function getNextSequenceNo() {
  const current = await getMeta(DEVICE_META_KEYS.NEXT_SEQUENCE_NO);
  const next = current ? parseInt(current, 10) + 1 : 1;
  await setMeta(DEVICE_META_KEYS.NEXT_SEQUENCE_NO, String(next));
  return next;
}

export { DEVICE_META_KEYS };

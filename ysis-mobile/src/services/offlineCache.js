/**
 * Read-only offline copy for admin lists (notifications, staff, devices, audit log...).
 * A successful fetch is saved on the phone. If the next fetch fails because there
 * is no connection, the saved copy is shown instead. Real server refusals (403,
 * 404, 500...) are never answered from the saved copy.
 * Copies belong to the signed-in account, are never used for Guests, and are
 * erased on logout (see wipeLocalData in db/index.js).
 */
import { getDb } from '../db';
import { api } from '../api/client';
import { getCachedUser } from './auth';

const MAX_CACHE_CHARS = 1000000;

let tableReady = null;
const notices = {};
const listeners = new Set();

function publish(group, value) {
  notices[group] = value;
  listeners.forEach((fn) => fn());
}

export function getCacheNotice(group) {
  return notices[group] || null;
}

export function subscribeCacheNotice(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function openDb() {
  const db = await getDb();
  if (!tableReady) {
    tableReady = db
      .execAsync(`CREATE TABLE IF NOT EXISTS api_cache_local (
        cache_key  TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        body       TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      )`)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  await tableReady;
  return db;
}

/**
 * Same result as api.get(path). `group` names the screen (for the notice),
 * `key` names this exact request (include any filters).
 */
export async function cachedGet({ group, key, path }) {
  let user = null;
  try {
    user = await getCachedUser();
  } catch (err) {
    user = null;
  }
  const usable = !!user && !!user.id && user.role !== 'guest';
  const cacheKey = usable ? `${user.id}:${key}` : null;

  try {
    const data = await api.get(path);
    publish(group, null);
    if (cacheKey) {
      try {
        const body = JSON.stringify(data);
        if (body.length <= MAX_CACHE_CHARS) {
          const db = await openDb();
          await db.runAsync(
            'INSERT OR REPLACE INTO api_cache_local (cache_key, user_id, body, fetched_at) VALUES (?, ?, ?, ?)',
            [cacheKey, String(user.id), body, new Date().toISOString()]
          );
        }
      } catch (err) {
        // The screen already has fresh data. A failed save only costs the offline copy.
      }
    }
    return data;
  } catch (err) {
    if (!err || !err.isNetworkError || !cacheKey) throw err;
    let row = null;
    try {
      const db = await openDb();
      row = await db.getFirstAsync(
        'SELECT body, fetched_at FROM api_cache_local WHERE cache_key = ? AND user_id = ?',
        [cacheKey, String(user.id)]
      );
    } catch (readErr) {
      row = null;
    }
    if (!row) throw err;
    let parsed;
    try {
      parsed = JSON.parse(row.body);
    } catch (parseErr) {
      throw err;
    }
    publish(group, { fetchedAt: row.fetched_at });
    return parsed;
  }
}

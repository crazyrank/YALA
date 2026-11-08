/**
 * Principal's personal log. Free-form notes that live only on this phone.
 * Never synced and never sent to the server. Each note belongs to the account
 * that wrote it, and logout does not clear it (wipeLocalData is untouched).
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';

const MAX_BODY = 4000;

let tableReady = null;

async function openDb() {
  const db = await getDb();
  if (!tableReady) {
    tableReady = (async () => {
      await db.execAsync(`CREATE TABLE IF NOT EXISTS personal_log_local (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        body        TEXT NOT NULL,
        pinned      INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )`);
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_personal_log_user ON personal_log_local (user_id, created_at)');
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
  return db;
}

function checkBody(raw) {
  const text = (raw || '').trim();
  if (!text) return { ok: false, message: 'Write something before saving.' };
  if (text.length > MAX_BODY) return { ok: false, message: `Keep the note under ${MAX_BODY} characters.` };
  return { ok: true, text };
}

export async function listPersonalLog(userId) {
  if (!userId) return [];
  const db = await openDb();
  return db.getAllAsync(
    'SELECT * FROM personal_log_local WHERE user_id = ? ORDER BY pinned DESC, created_at DESC',
    [String(userId)]
  );
}

export async function addPersonalLog({ userId, body }) {
  if (!userId) return { ok: false, message: 'You are not signed in.' };
  const text = checkBody(body);
  if (!text.ok) return text;
  const db = await openDb();
  const now = new Date().toISOString();
  const id = uuidv4();
  await db.runAsync(
    'INSERT INTO personal_log_local (id, user_id, body, pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
    [id, String(userId), text.text, now, now]
  );
  return { ok: true, id };
}

export async function updatePersonalLog({ userId, id, body }) {
  if (!userId) return { ok: false, message: 'You are not signed in.' };
  const text = checkBody(body);
  if (!text.ok) return text;
  const db = await openDb();
  const res = await db.runAsync(
    'UPDATE personal_log_local SET body = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [text.text, new Date().toISOString(), id, String(userId)]
  );
  if (!res.changes) return { ok: false, message: 'That note could not be found.' };
  return { ok: true };
}

export async function setPersonalLogPinned({ userId, id, pinned }) {
  if (!userId) return { ok: false, message: 'You are not signed in.' };
  const db = await openDb();
  await db.runAsync(
    'UPDATE personal_log_local SET pinned = ? WHERE id = ? AND user_id = ?',
    [pinned ? 1 : 0, id, String(userId)]
  );
  return { ok: true };
}

export async function deletePersonalLog({ userId, id }) {
  if (!userId) return { ok: false, message: 'You are not signed in.' };
  const db = await openDb();
  await db.runAsync('DELETE FROM personal_log_local WHERE id = ? AND user_id = ?', [id, String(userId)]);
  return { ok: true };
}

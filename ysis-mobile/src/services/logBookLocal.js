/**
 * Log book on the phone. Reads and writes the local copy and queues one sync
 * operation per change, so it works with no signal.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { ensureLogColumns } from '../db/logBookColumns';
import { queueOperation } from './syncEngine';

const MAX_BODY = 4000;
const MAX_BACKDATE_DAYS = 7;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

async function openDb() {
  const db = await getDb();
  await ensureLogColumns(db);
  return db;
}

function localIso(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function checkBody(raw) {
  const text = (raw || '').trim();
  if (!text) return { ok: false, message: 'Write what happened in the class.' };
  if (text.length > MAX_BODY) return { ok: false, message: `Keep the entry under ${MAX_BODY} characters.` };
  return { ok: true, text };
}

export async function listLogEntries(from, to) {
  const db = await openDb();
  return db.getAllAsync(
    'SELECT * FROM log_entries_local WHERE entry_date BETWEEN ? AND ? ORDER BY entry_date DESC, written_at DESC',
    [from, to]
  );
}

export async function createLogEntry({ userId, entryDate, body }) {
  const text = checkBody(body);
  if (!text.ok) return text;

  const today = localIso(0);
  if (entryDate > today) return { ok: false, message: 'An entry cannot be dated in the future.' };
  const daysBack = (new Date(today) - new Date(entryDate)) / 86400000;
  if (daysBack > MAX_BACKDATE_DAYS) {
    return { ok: false, message: `Entries can be dated up to ${MAX_BACKDATE_DAYS} days back.` };
  }

  const db = await openDb();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO log_entries_local (id, entry_date, body, written_by, written_at, local_dirty)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, entryDate, text.text, userId, new Date().toISOString()]
  );
  await queueOperation({ opType: 'log_entry_create', entityId: id, payload: { entryDate, body: text.text } });
  return { ok: true, id };
}

export async function correctLogEntry({ userId, id, body }) {
  const text = checkBody(body);
  if (!text.ok) return text;

  const db = await openDb();
  const row = await db.getFirstAsync('SELECT written_by, written_at FROM log_entries_local WHERE id = ?', [id]);
  if (!row) return { ok: false, message: 'That entry could not be found.' };
  if (row.written_by !== userId) return { ok: false, message: 'Only the person who wrote this entry can correct it.' };
  if (Date.now() - new Date(row.written_at).getTime() > EDIT_WINDOW_MS) {
    return { ok: false, message: 'Entries can be corrected only within 24 hours of being written.' };
  }

  await db.runAsync(
    `UPDATE log_entries_local
        SET original_body = COALESCE(original_body, body), body = ?,
            corrected_at = ?, correction_count = correction_count + 1, local_dirty = 1
      WHERE id = ?`,
    [text.text, new Date().toISOString(), id]
  );
  await queueOperation({ opType: 'log_entry_edit', entityId: id, payload: { body: text.text } });
  return { ok: true };
}

/**
 * Black Book on the phone (Principal only). Works offline: reads and writes the
 * local copy and queues one sync operation per change.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { api } from '../api/client';
import { queueOperation } from './syncEngine';

const MAX_BODY = 4000;

function checkBody(raw) {
  const text = (raw || '').trim();
  if (!text) return { ok: false, message: 'Write the entry before saving.' };
  if (text.length > MAX_BODY) return { ok: false, message: `Keep the entry under ${MAX_BODY} characters.` };
  return { ok: true, text };
}

// Refreshes the local copy from the server. Rows with unsynced changes are never overwritten.
export async function pullBlackBook() {
  const db = await getDb();
  const response = await api.get('/black-book');
  const entries = Array.isArray(response.entries) ? response.entries : [];

  await db.withTransactionAsync(async () => {
    for (const e of entries) {
      await db.runAsync(
        `INSERT INTO black_book_local
           (id, entry_date, body, original_body, written_by, written_at, corrected_at, correction_count, local_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           entry_date = excluded.entry_date,
           body = excluded.body,
           original_body = excluded.original_body,
           written_by = excluded.written_by,
           written_at = excluded.written_at,
           corrected_at = excluded.corrected_at,
           correction_count = excluded.correction_count,
           local_dirty = 0
         WHERE black_book_local.local_dirty = 0`,
        [e.id, e.entryDate, e.body, e.originalBody ?? null, e.writtenBy, e.writtenAt,
          e.correctedAt ?? null, e.correctionCount || 0]
      );
    }
  });
  return listBlackBook();
}

export async function listBlackBook() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM black_book_local ORDER BY written_at DESC');
}

export async function createBlackBookEntry({ userId, body }) {
  const text = checkBody(body);
  if (!text.ok) return text;

  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO black_book_local (id, entry_date, body, written_by, written_at, local_dirty)
     VALUES (?, date('now', 'localtime'), ?, ?, ?, 1)`,
    [id, text.text, userId, now]
  );
  await queueOperation({ opType: 'black_book_save', entityId: id, payload: { action: 'create', body: text.text } });
  return { ok: true, id };
}

// Only the writer can correct, at any time. The first text is kept.
export async function correctBlackBookEntry({ userId, id, body }) {
  const text = checkBody(body);
  if (!text.ok) return text;

  const db = await getDb();
  const row = await db.getFirstAsync('SELECT written_by FROM black_book_local WHERE id = ?', [id]);
  if (!row) return { ok: false, message: 'That entry could not be found.' };
  if (row.written_by !== userId) {
    return { ok: false, message: 'Only the person who wrote this entry can correct it.' };
  }

  await db.runAsync(
    `UPDATE black_book_local
        SET original_body = COALESCE(original_body, body),
            body = ?,
            corrected_at = ?,
            correction_count = correction_count + 1,
            local_dirty = 1
      WHERE id = ?`,
    [text.text, new Date().toISOString(), id]
  );
  await queueOperation({ opType: 'black_book_save', entityId: id, payload: { action: 'correct', body: text.text } });
  return { ok: true };
}

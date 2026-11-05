/**
 * Staff directory on the phone. Shows the local copy, saves changes locally, and
 * queues one sync operation per change. The list is refreshed from the server after each sync.
 */
import { v4 as uuidv4 } from 'uuid';
import { api } from '../api/client';
import { getDb } from '../db';
import { queueOperation } from './syncEngine';

const DATA_KEYS = { board: 'board', management: 'management', class_teacher: 'classTeachers' };

async function openDb() {
  const db = await getDb();
  await db.execAsync(`CREATE TABLE IF NOT EXISTS directory_local (
    id TEXT PRIMARY KEY,
    section TEXT NOT NULL,
    full_name TEXT NOT NULL,
    title TEXT NOT NULL,
    photo_url TEXT,
    linked_user_id TEXT,
    created_at TEXT,
    local_dirty INTEGER NOT NULL DEFAULT 0
  )`);
  return db;
}

function toEntry(r) {
  return {
    id: r.id,
    section: r.section,
    fullName: r.full_name,
    title: r.title,
    photoUrl: r.photo_url,
    linkedUserId: r.linked_user_id,
    createdAt: r.created_at,
  };
}

async function hasPending(db, id) {
  const row = await db.getFirstAsync(
    "SELECT 1 AS p FROM sync_operations WHERE entity_id = ? AND status = 'pending' AND op_type LIKE 'directory_%' LIMIT 1",
    [id]
  );
  return !!row;
}

/** Same shape the old screen expected from GET /directory. Hides entries waiting to be deleted. */
export async function readDirectoryGrouped() {
  const db = await openDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM directory_local
      WHERE id NOT IN (SELECT entity_id FROM sync_operations WHERE op_type = 'directory_delete' AND status = 'pending')
      ORDER BY created_at ASC`
  );
  const grouped = { board: [], management: [], classTeachers: [] };
  for (const r of rows) {
    const key = DATA_KEYS[r.section];
    if (key) grouped[key].push(toEntry(r));
  }
  return grouped;
}

/** Called after each sync. Entries with an unsent local change are left alone. */
export async function pullDirectory() {
  const res = await api.get('/directory');
  const serverRows = [...(res.board || []), ...(res.management || []), ...(res.classTeachers || [])];
  const serverIds = new Set(serverRows.map((r) => r.id));
  const db = await openDb();

  await db.withTransactionAsync(async () => {
    const local = await db.getAllAsync('SELECT id FROM directory_local');
    for (const row of local) {
      if (!serverIds.has(row.id) && !(await hasPending(db, row.id))) {
        await db.runAsync('DELETE FROM directory_local WHERE id = ?', [row.id]);
      }
    }
    for (const r of serverRows) {
      if (await hasPending(db, r.id)) continue;
      await db.runAsync(
        `INSERT INTO directory_local (id, section, full_name, title, photo_url, linked_user_id, created_at, local_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           section = excluded.section, full_name = excluded.full_name, title = excluded.title,
           photo_url = excluded.photo_url, linked_user_id = excluded.linked_user_id,
           created_at = excluded.created_at, local_dirty = 0`,
        [r.id, r.section, r.fullName, r.title, r.photoUrl || null, r.linkedUserId || null, r.createdAt || null]
      );
    }
  });
}

function photoPreview(photoBase64) {
  return photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : null;
}

export async function createDirectoryEntry({ section, fullName, title, photoBase64 }) {
  const name = (fullName || '').trim();
  const role = (title || '').trim();
  if (!name || !role) throw new Error('Enter a name and a title.');

  const db = await openDb();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO directory_local (id, section, full_name, title, photo_url, linked_user_id, created_at, local_dirty)
     VALUES (?, ?, ?, ?, ?, NULL, ?, 1)`,
    [id, section, name, role, photoPreview(photoBase64), new Date().toISOString()]
  );
  const payload = { section, fullName: name, title: role };
  if (photoBase64) payload.photoBase64 = photoBase64;
  await queueOperation({ opType: 'directory_create', entityId: id, payload });
  return { ok: true, id };
}

export async function updateDirectoryEntry({ id, fullName, title, photoBase64 }) {
  const db = await openDb();
  const row = await db.getFirstAsync('SELECT * FROM directory_local WHERE id = ?', [id]);
  if (!row) throw new Error('That staff directory entry could not be found.');
  if (row.linked_user_id) throw new Error('This card is linked to a login account and updates automatically.');

  const name = (fullName || '').trim();
  const role = (title || '').trim();
  if (!name || !role) throw new Error('Enter a name and a title.');

  await db.runAsync(
    `UPDATE directory_local SET full_name = ?, title = ?, photo_url = COALESCE(?, photo_url), local_dirty = 1 WHERE id = ?`,
    [name, role, photoPreview(photoBase64), id]
  );
  const payload = { fullName: name, title: role };
  if (photoBase64) payload.photoBase64 = photoBase64;
  await queueOperation({ opType: 'directory_update', entityId: id, payload });
  return { ok: true };
}

export async function deleteDirectoryEntry({ id }) {
  const db = await openDb();
  const row = await db.getFirstAsync('SELECT linked_user_id FROM directory_local WHERE id = ?', [id]);
  if (row && row.linked_user_id) {
    throw new Error('This card is linked to a login account and cannot be removed here.');
  }
  await queueOperation({ opType: 'directory_delete', entityId: id, payload: {} });
  await db.runAsync('DELETE FROM directory_local WHERE id = ?', [id]);
  return { ok: true };
}

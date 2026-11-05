/**
 * Alumni records on the phone. Works offline: reads and writes the local copy and
 * queues one sync operation per change. The server enforces division limits too.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { api } from '../api/client';
import { queueOperation } from './syncEngine';

const DIVISIONS = ['primary', 'secondary'];
const STATUSES = ['contactable', 'opted_out', 'deceased'];
const MAX_TEXT = 500;
const TEXT_FIELDS = ['graduationSession', 'lastClassLevel', 'phone', 'email', 'address', 'notes'];

const COLUMN = {
  fullName: 'full_name',
  division: 'division',
  graduationSession: 'graduation_session',
  lastClassLevel: 'last_class_level',
  phone: 'phone',
  email: 'email',
  address: 'address',
  notes: 'notes',
  contactStatus: 'contact_status',
};

// Checks and trims the fields sent from the screen. Blank optional text becomes null.
function checkFields(raw, { requireAll }) {
  const out = {};
  if (requireAll || raw.fullName !== undefined) {
    const name = (raw.fullName || '').trim();
    if (name.length < 2) return { ok: false, message: 'Enter the full name.' };
    out.fullName = name;
  }
  if (requireAll || raw.division !== undefined) {
    if (!DIVISIONS.includes(raw.division)) return { ok: false, message: 'Choose primary or secondary.' };
    out.division = raw.division;
  }
  for (const key of TEXT_FIELDS) {
    if (raw[key] === undefined) continue;
    const trimmed = (raw[key] || '').trim();
    if (trimmed.length > MAX_TEXT) return { ok: false, message: `Keep ${key} under ${MAX_TEXT} characters.` };
    out[key] = trimmed || null;
  }
  if (raw.contactStatus !== undefined) {
    if (!STATUSES.includes(raw.contactStatus)) return { ok: false, message: 'Choose a valid contact status.' };
    out.contactStatus = raw.contactStatus;
  }
  return { ok: true, value: out };
}

// Refreshes the local copy from the server. Rows with unsynced changes are never overwritten.
export async function pullAlumni() {
  const db = await getDb();
  const response = await api.get('/alumni?status=all');
  const records = Array.isArray(response.records) ? response.records : [];
  const serverIds = new Set(records.map((r) => r.id));

  await db.withTransactionAsync(async () => {
    const local = await db.getAllAsync('SELECT id, local_dirty FROM alumni_local');
    for (const row of local) {
      if (!serverIds.has(row.id) && row.local_dirty === 0) {
        await db.runAsync('DELETE FROM alumni_local WHERE id = ?', [row.id]);
      }
    }
    for (const r of records) {
      await db.runAsync(
        `INSERT INTO alumni_local
           (id, full_name, division, graduation_session, last_class_level, phone, email,
            address, notes, contact_status, updated_at, local_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           full_name = excluded.full_name,
           division = excluded.division,
           graduation_session = excluded.graduation_session,
           last_class_level = excluded.last_class_level,
           phone = excluded.phone,
           email = excluded.email,
           address = excluded.address,
           notes = excluded.notes,
           contact_status = excluded.contact_status,
           updated_at = excluded.updated_at,
           local_dirty = 0
         WHERE alumni_local.local_dirty = 0`,
        [r.id, r.fullName, r.division ?? null, r.graduationSession ?? null, r.lastClassLevel ?? null,
          r.phone ?? null, r.email ?? null, r.address ?? null, r.notes ?? null,
          r.contactStatus, r.updatedAt ?? null]
      );
    }
  });
  return listAlumni();
}

export async function listAlumni() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM alumni_local ORDER BY full_name COLLATE NOCASE ASC');
}

// allowedDivisions: null for Principal and Director, or the Head Teacher's own divisions.
export async function createAlumni({ fields, allowedDivisions = null }) {
  const checked = checkFields(fields, { requireAll: true });
  if (!checked.ok) return checked;
  const v = checked.value;
  if (allowedDivisions && !allowedDivisions.includes(v.division)) {
    return { ok: false, message: 'You can add alumni only in your own division.' };
  }

  const status = fields.contactStatus || 'contactable';
  if (!STATUSES.includes(status)) return { ok: false, message: 'Choose a valid contact status.' };

  const db = await getDb();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO alumni_local
       (id, full_name, division, graduation_session, last_class_level, phone, email,
        address, notes, contact_status, updated_at, local_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, v.fullName, v.division, v.graduationSession ?? null, v.lastClassLevel ?? null,
      v.phone ?? null, v.email ?? null, v.address ?? null, v.notes ?? null, status,
      new Date().toISOString()]
  );
  await queueOperation({
    opType: 'alumni_save',
    entityId: id,
    payload: { action: 'create', fields: { ...v, contactStatus: status } },
  });
  return { ok: true, id };
}

export async function updateAlumni({ id, fields, allowedDivisions = null }) {
  const checked = checkFields(fields, { requireAll: false });
  if (!checked.ok) return checked;
  const v = checked.value;
  const keys = Object.keys(v);
  if (keys.length === 0) return { ok: false, message: 'Nothing to change.' };

  const db = await getDb();
  const row = await db.getFirstAsync('SELECT division FROM alumni_local WHERE id = ?', [id]);
  if (!row) return { ok: false, message: 'That alumni record could not be found.' };
  if (allowedDivisions && !allowedDivisions.includes(row.division)) {
    return { ok: false, message: 'You can change alumni only in your own division.' };
  }
  if (v.division !== undefined && allowedDivisions && !allowedDivisions.includes(v.division)) {
    return { ok: false, message: 'You can move alumni only into your own division.' };
  }

  const sets = keys.map((key) => `${COLUMN[key]} = ?`);
  const params = keys.map((key) => v[key]);
  await db.runAsync(
    `UPDATE alumni_local SET ${sets.join(', ')}, updated_at = ?, local_dirty = 1 WHERE id = ?`,
    [...params, new Date().toISOString(), id]
  );
  await queueOperation({ opType: 'alumni_save', entityId: id, payload: { action: 'update', fields: v } });
  return { ok: true };
}

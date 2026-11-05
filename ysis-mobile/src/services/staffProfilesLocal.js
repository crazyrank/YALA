import { getDb } from '../db';
import { api } from '../api/client';
import { queueOperation } from './syncEngine';

const PROFILE_OP = 'staff_profile_update';

function parseRow(row) {
  if (!row) return null;
  return JSON.parse(row.data_json);
}

async function hasUnresolvedEdit(db, id) {
  return db.getFirstAsync(
    `SELECT 1 AS waiting FROM sync_operations
      WHERE entity_id = ? AND op_type = ? AND status IN ('pending','failed','conflicted') LIMIT 1`,
    [id, PROFILE_OP]
  );
}

export async function getCachedStaffProfiles() {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT data_json FROM staff_profiles_local');
  return rows.map(parseRow).filter(Boolean).sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
}

export async function getCachedStaffProfile(id) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT data_json FROM staff_profiles_local WHERE id = ?', [id]);
  return parseRow(row);
}

async function cacheProfile(db, profile) {
  await db.runAsync(
    `INSERT INTO staff_profiles_local (id, data_json, version, local_dirty, cached_at)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json,
       version = excluded.version, local_dirty = 0, cached_at = excluded.cached_at`,
    [profile.id, JSON.stringify(profile), Number(profile.version || 1), new Date().toISOString()]
  );
}

export async function pullStaffProfiles() {
  const db = await getDb();
  const response = await api.get('/staff-profiles');
  const rows = response.staff || [];
  const allowedIds = new Set(rows.map((row) => row.id));
  const details = [];

  for (const row of rows) {
    try {
      const detail = await api.get(`/staff-profiles/${row.id}`);
      if (detail?.profile) details.push(detail.profile);
    } catch (err) {
      // A single unavailable profile must not discard the other cached profiles.
    }
  }

  await db.withTransactionAsync(async () => {
    const localRows = await db.getAllAsync('SELECT id FROM staff_profiles_local');
    for (const local of localRows) {
      if (!allowedIds.has(local.id) && !(await hasUnresolvedEdit(db, local.id))) {
        await db.runAsync('DELETE FROM staff_profiles_local WHERE id = ?', [local.id]);
      }
    }
    for (const profile of details) {
      if (await hasUnresolvedEdit(db, profile.id)) continue;
      await cacheProfile(db, profile);
    }
  });
  return getCachedStaffProfiles();
}

export async function saveStaffProfileOffline(profile, values) {
  const fullName = String(values.fullName || '').trim().replace(/\s+/g, ' ');
  const email = String(values.email || '').trim().toLowerCase();
  const phoneText = String(values.phone || '').trim();
  const phone = phoneText || null;
  if (fullName.length < 2 || fullName.length > 100) {
    throw new Error('Enter a name between 2 and 100 characters.');
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
    throw new Error('Enter a valid phone number.');
  }
  if (!profile || !profile.id || !Number.isSafeInteger(Number(profile.version))) {
    throw new Error('This profile has no valid server version. Connect to the internet and refresh it first.');
  }
  if (profile.canEdit !== true) throw new Error('You are not allowed to edit this profile.');

  const db = await getDb();
  const current = await getCachedStaffProfile(profile.id);
  if (!current) throw new Error('This profile is not cached on this phone. Connect to the internet and open it first.');
  if (await hasUnresolvedEdit(db, profile.id)) {
    throw new Error('A previous edit for this profile is still awaiting sync or needs attention. Resolve it before making another edit.');
  }
  const payload = { fullName, email, phone, baseVersion: Number(current.version || profile.version) };
  const optimistic = { ...current, fullName, email, phone };
  await db.runAsync(
    'UPDATE staff_profiles_local SET data_json = ?, local_dirty = 1 WHERE id = ?',
    [JSON.stringify(optimistic), profile.id]
  );
  try {
    await queueOperation({ opType: PROFILE_OP, entityId: profile.id, payload });
  } catch (err) {
    await db.runAsync(
      'UPDATE staff_profiles_local SET data_json = ?, local_dirty = 0 WHERE id = ?',
      [JSON.stringify(current), profile.id]
    );
    throw err;
  }
  return { ok: true };
}

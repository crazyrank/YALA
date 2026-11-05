/**
 * Pulls biodata changes from the server into the phone. Runs after each sync.
 * A record with an unsent local change is left alone, so the phone never
 * overwrites its own pending edit with older server data.
 */
import { api } from '../api/client';
import { getDb, getMeta, setMeta } from '../db';

const PAGE = 200;
const SINCE_KEY = 'biodata_since';
const AFTER_KEY = 'biodata_after_id';
const EPOCH = '1970-01-01T00:00:00.000Z';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

export async function pullBiodataChanges() {
  const db = await getDb();
  // Bounded loop: each page moves the cursor forward, and the last page ends it.
  for (let page = 0; page < 500; page += 1) {
    const since = (await getMeta(SINCE_KEY)) || EPOCH;
    const afterId = (await getMeta(AFTER_KEY)) || ZERO_UUID;
    const res = await api.get(
      `/student-biodata/changes?since=${encodeURIComponent(since)}&afterId=${afterId}&limit=${PAGE}`
    );
    const rows = res.rows || [];
    for (const row of rows) {
      await applyChange(db, row);
    }
    if (rows.length > 0) {
      const last = rows[rows.length - 1];
      await setMeta(SINCE_KEY, last.updatedAt);
      await setMeta(AFTER_KEY, last.studentId);
    }
    if (!res.hasMore) break;
  }
}

async function applyChange(db, row) {
  const waiting = await db.getFirstAsync(
    "SELECT 1 AS waiting FROM sync_operations WHERE entity_id = ? AND status = 'pending' AND op_type LIKE 'biodata_%' LIMIT 1",
    [row.studentId]
  );
  if (waiting) return;

  await db.runAsync(
    `INSERT INTO biodata_local
       (student_id, data_json, approval_status, return_reason, version, updated_at, local_dirty)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(student_id) DO UPDATE SET
       data_json = excluded.data_json,
       approval_status = excluded.approval_status,
       return_reason = excluded.return_reason,
       version = excluded.version,
       updated_at = excluded.updated_at,
       local_dirty = 0`,
    [
      row.studentId,
      JSON.stringify(row.biodata || {}),
      row.approvalStatus,
      row.returnReason,
      row.version,
      row.updatedAt,
    ]
  );
}

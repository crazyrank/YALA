/**
 * Pulls log book changes from the server after each sync. An entry with an unsent
 * local change is left alone, so the phone never overwrites its own pending edit.
 */
import { api } from '../api/client';
import { getDb, getMeta, setMeta } from '../db';
import { ensureLogColumns } from '../db/logBookColumns';

const PAGE = 200;
const EPOCH = '1970-01-01T00:00:00.000Z';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

export async function pullLogEntries() {
  const db = await getDb();
  await ensureLogColumns(db);
  for (let page = 0; page < 500; page += 1) {
    const since = (await getMeta('log_since')) || EPOCH;
    const afterId = (await getMeta('log_after_id')) || ZERO_UUID;
    const res = await api.get(
      `/log-entries/changes?since=${encodeURIComponent(since)}&afterId=${afterId}&limit=${PAGE}`
    );
    const rows = res.rows || [];
    for (const row of rows) {
      await applyEntry(db, row);
    }
    if (rows.length > 0) {
      const last = rows[rows.length - 1];
      await setMeta('log_since', last.changedAt);
      await setMeta('log_after_id', last.id);
    }
    if (!res.hasMore) break;
  }
}

async function applyEntry(db, r) {
  const waiting = await db.getFirstAsync(
    "SELECT 1 AS waiting FROM sync_operations WHERE entity_id = ? AND status = 'pending' AND op_type LIKE 'log_entry_%' LIMIT 1",
    [r.id]
  );
  if (waiting) return;

  await db.runAsync(
    `INSERT INTO log_entries_local
       (id, entry_date, body, written_by, written_at, local_dirty, division, class_level, arm,
        original_body, corrected_at, correction_count, written_by_name)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       entry_date = excluded.entry_date, body = excluded.body, written_by = excluded.written_by,
       written_at = excluded.written_at, local_dirty = 0, division = excluded.division,
       class_level = excluded.class_level, arm = excluded.arm, original_body = excluded.original_body,
       corrected_at = excluded.corrected_at, correction_count = excluded.correction_count,
       written_by_name = excluded.written_by_name`,
    [
      r.id, r.entryDate, r.body, r.writtenBy, r.writtenAt, r.division, r.classLevel, r.arm,
      r.originalBody, r.correctedAt, r.correctionCount, r.writtenByName,
    ]
  );
}

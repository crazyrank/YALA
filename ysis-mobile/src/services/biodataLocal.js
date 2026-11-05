/**
 * Biodata on the phone. Reads and writes the local copy, then queues one sync
 * operation per change. Works with no signal; the queue sends when online.
 */
import { getDb } from '../db';
import { queueOperation } from './syncEngine';
import { planSave, planReview } from '../utils/biodataApproval';

function parseRow(row) {
  if (!row) {
    return {
      exists: false, data: {}, approvalStatus: null, returnReason: null,
      version: 0, localDirty: false, updatedAt: null,
    };
  }
  let data = {};
  try { data = JSON.parse(row.data_json || '{}'); } catch (e) { data = {}; }
  return {
    exists: true,
    data,
    approvalStatus: row.approval_status,
    returnReason: row.return_reason,
    version: row.version,
    localDirty: row.local_dirty === 1,
    updatedAt: row.updated_at,
  };
}

export async function readBiodata(studentId) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM biodata_local WHERE student_id = ?', [studentId]);
  return parseRow(row);
}

/** patch: only the changed fields (from buildPatch). */
export async function saveBiodata({ studentId, role, patch }) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM biodata_local WHERE student_id = ?', [studentId]);
  const plan = planSave(role, row ? row.approval_status : null);
  if (!plan.ok) return plan;

  const data = { ...parseRow(row).data };
  Object.entries(patch).forEach(([key, value]) => { data[key] = value; });

  await db.runAsync(
    `INSERT INTO biodata_local (student_id, data_json, approval_status, return_reason, version, updated_at, local_dirty)
     VALUES (?, ?, ?, NULL, 1, ?, 1)
     ON CONFLICT(student_id) DO UPDATE SET
       data_json = excluded.data_json,
       approval_status = excluded.approval_status,
       return_reason = NULL,
       version = biodata_local.version + 1,
       updated_at = excluded.updated_at,
       local_dirty = 1`,
    [studentId, JSON.stringify(data), plan.status, new Date().toISOString()]
  );

  await queueOperation({ opType: 'biodata_save', entityId: studentId, payload: { fields: patch } });
  return { ok: true, status: plan.status };
}

/** action: 'approve' | 'return'. reason is required for 'return'. */
export async function reviewBiodata({ studentId, role, action, reason }) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT approval_status FROM biodata_local WHERE student_id = ?', [studentId]);
  const plan = planReview(role, row ? row.approval_status : null, action, reason);
  if (!plan.ok) return plan;

  await db.runAsync(
    `UPDATE biodata_local
        SET approval_status = ?, return_reason = ?, version = version + 1,
            updated_at = ?, local_dirty = 1
      WHERE student_id = ?`,
    [plan.status, plan.reason, new Date().toISOString(), studentId]
  );

  await queueOperation({
    opType: 'biodata_review',
    entityId: studentId,
    payload: { action, reason: plan.reason },
  });
  return { ok: true, status: plan.status };
}

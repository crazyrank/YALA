'use strict';
/**
 * Biodata writes and reads shared by the online routes and the sync queue.
 * Both paths call the same functions, so the rules cannot drift apart.
 */
const db = require('../db');
const { validateBiodata, FIELD_NAMES } = require('../utils/biodataRules');
const { planSave, planReview } = require('../utils/biodataApproval');
const { getScopeForUser, isWithinScope, scopeToSqlClause } = require('./studentScopeService');
const { writeAudit } = require('../middleware/audit');

const DATE_FIELD = 'admission_date';

const OUT_COLUMNS = FIELD_NAMES.map((f) =>
  f === DATE_FIELD ? "to_char(admission_date, 'YYYY-MM-DD') AS admission_date" : f
).join(', ');

const OUT_COLUMNS_B = FIELD_NAMES.map((f) =>
  f === DATE_FIELD ? "to_char(b.admission_date, 'YYYY-MM-DD') AS admission_date" : `b.${f}`
).join(', ');

const STATUS_COLUMNS = 'approval_status, return_reason, version, updated_at';

function fail(code, message) {
  return { ok: false, code, message };
}

/** auth: { userId, role }. Returns { ok: true } or a failure object. */
async function checkStudentInScope(studentId, auth) {
  const { rows } = await db.query(
    'SELECT id, division, class_level, arm FROM students WHERE id = $1',
    [studentId]
  );
  const student = rows[0];
  if (!student) return fail('NOT_FOUND', 'That student could not be found.');

  const scope = await getScopeForUser({ role: auth.role, userId: auth.userId });
  if (!isWithinScope(scope, { division: student.division, classLevel: student.class_level, arm: student.arm })) {
    return fail('FORBIDDEN', "You do not have permission to open this student's biodata.");
  }
  return { ok: true };
}

async function currentStatus(studentId) {
  const { rows } = await db.query(
    'SELECT approval_status FROM student_biodata WHERE student_id = $1',
    [studentId]
  );
  return rows[0] ? rows[0].approval_status : null;
}

/** fields: the biodata fields to change. Only the sent fields are written. */
async function applyBiodataSave({ studentId, auth, fields }) {
  const edit = validateBiodata(fields);
  if (!edit.ok) return fail(edit.code, edit.message);

  const scoped = await checkStudentInScope(studentId, auth);
  if (!scoped.ok) return scoped;

  const plan = planSave(auth.role, await currentStatus(studentId));
  if (!plan.ok) return fail(plan.code, plan.message);

  const cols = Object.keys(edit.changes);
  const approved = plan.status === 'approved';
  const colList = [
    'student_id', 'updated_by', 'approval_status', 'return_reason',
    'submitted_by', 'approved_by', 'approved_at', ...cols,
  ];
  const values = [
    studentId,
    auth.userId,
    plan.status,
    null,
    approved ? null : auth.userId,
    approved ? auth.userId : null,
    approved ? new Date().toISOString() : null,
    ...cols.map((c) => edit.changes[c]),
  ];
  const placeholders = colList.map((_, i) => `$${i + 1}`).join(', ');
  const updates = [
    ...cols.map((c) => `${c} = EXCLUDED.${c}`),
    'approval_status = EXCLUDED.approval_status',
    'return_reason = NULL',
    "submitted_by = CASE WHEN EXCLUDED.approval_status = 'pending' THEN EXCLUDED.submitted_by ELSE student_biodata.submitted_by END",
    'approved_by = EXCLUDED.approved_by',
    'approved_at = EXCLUDED.approved_at',
    'updated_by = EXCLUDED.updated_by',
    'version = student_biodata.version + 1',
    'updated_at = now()',
  ].join(', ');

  const { rows } = await db.query(
    `INSERT INTO student_biodata (${colList.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT (student_id) DO UPDATE SET ${updates}
     RETURNING ${OUT_COLUMNS}, ${STATUS_COLUMNS}`,
    values
  );
  return { ok: true, row: rows[0], fields: cols };
}

/** action: 'approve' | 'return'. Only a pending record can be reviewed. */
async function applyBiodataReview({ studentId, auth, action, reason }) {
  const scoped = await checkStudentInScope(studentId, auth);
  if (!scoped.ok) return scoped;

  const plan = planReview(auth.role, await currentStatus(studentId), action, reason);
  if (!plan.ok) return fail(plan.code, plan.message);

  const approve = plan.status === 'approved';
  const { rows } = await db.query(
    `UPDATE student_biodata
        SET approval_status = $2, return_reason = $3,
            approved_by = $4, approved_at = $5,
            updated_by = $6, version = version + 1, updated_at = now()
      WHERE student_id = $1 AND approval_status = 'pending'
      RETURNING ${OUT_COLUMNS}, ${STATUS_COLUMNS}`,
    [
      studentId,
      plan.status,
      plan.reason,
      approve ? auth.userId : null,
      approve ? new Date().toISOString() : null,
      auth.userId,
    ]
  );
  if (rows.length === 0) {
    return fail('NOT_PENDING', 'Only biodata waiting for approval can be approved or returned.');
  }
  return { ok: true, row: rows[0], action: approve ? 'approve' : 'return' };
}

function toPublic(row) {
  const biodata = {};
  FIELD_NAMES.forEach((f) => { biodata[f] = row[f] === undefined ? null : row[f]; });
  return {
    studentId: row.student_id,
    biodata,
    approvalStatus: row.approval_status,
    returnReason: row.return_reason,
    version: row.version,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

/**
 * Change feed for phones. Oldest change first. Paging uses (updated_at, student_id),
 * so no record is skipped when two share a timestamp.
 */
async function getBiodataChanges({ auth, since, afterId, limit }) {
  const scope = await getScopeForUser({ role: auth.role, userId: auth.userId });

  const params = [since, afterId];
  const conditions = ['(b.updated_at, b.student_id) > ($1::timestamptz, $2::uuid)'];
  let idx = 3;

  if (scope !== null) {
    const { clause, params: scopeParams } = scopeToSqlClause(scope, idx);
    conditions.push(`(${clause})`);
    params.push(...scopeParams);
    idx += scopeParams.length;
  }

  params.push(limit + 1);
  const { rows } = await db.query(
    `SELECT b.student_id, ${OUT_COLUMNS_B}, b.approval_status, b.return_reason, b.version, b.updated_at
       FROM student_biodata b
       JOIN students s ON s.id = b.student_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.updated_at ASC, b.student_id ASC
      LIMIT $${idx}`,
    params
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { rows: page.map(toPublic), hasMore };
}

/**
 * Runs one queued biodata operation from /sync. Records the outcome on the
 * sync operation row through markStatus (the sync service's own helper).
 */
async function handleBiodataOperation({ operation, userId, userRole, deviceId, syncOpRowId, markStatus }) {
  const auth = { userId, role: userRole, deviceId };
  const { operationId, opType, entityId, payload } = operation;

  const result = opType === 'biodata_save'
    ? await applyBiodataSave({ studentId: entityId, auth, fields: payload.fields })
    : await applyBiodataReview({ studentId: entityId, auth, action: payload.action, reason: payload.reason });

  if (!result.ok) {
    await markStatus(syncOpRowId, 'failed', result.message);
    return { operationId, status: 'failed', error: result.code, message: result.message };
  }

  await markStatus(syncOpRowId, 'synced');

  let action = 'STUDENT_BIODATA_UPDATED';
  let metadata = { fields: result.fields };
  if (opType === 'biodata_review') {
    action = result.action === 'approve' ? 'STUDENT_BIODATA_APPROVED' : 'STUDENT_BIODATA_RETURNED';
    metadata = { action: result.action };
  }
  await writeAudit({
    userId, deviceId, action, entityType: 'student', entityId, result: 'success', metadata,
  });

  return { operationId, status: 'synced' };
}

module.exports = {
  checkStudentInScope,
  applyBiodataSave,
  applyBiodataReview,
  getBiodataChanges,
  handleBiodataOperation,
  OUT_COLUMNS,
};

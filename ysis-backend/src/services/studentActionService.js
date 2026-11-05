'use strict';
/**
 * Student actions queued from the phone: leave, entrance outcome, and inactive /
 * clear inactive. Same rules and the same version check as the online routes
 * (students.routes.js, studentStatus.routes.js). The phone sends basedOnVersion,
 * the sync_version it last saw. If the record has changed since, the change is refused.
 */
const db = require('../db');
const { planLeave } = require('../utils/leaveRules');
const { getScopeForUser, isWithinScope } = require('./studentScopeService');
const { writeAudit } = require('../middleware/audit');

const ADMIN_ROLES = ['principal', 'director'];
const INACTIVE_FROM = ['registered', 'active', 'promoted'];

function fail(code, message) {
  return { ok: false, code, message };
}

async function loadScopedStudent(studentId, auth) {
  const { rows } = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
  const student = rows[0];
  if (!student) return fail('NOT_FOUND', 'That student could not be found.');
  const scope = await getScopeForUser({ role: auth.role, userId: auth.userId });
  if (!isWithinScope(scope, { division: student.division, classLevel: student.class_level, arm: student.arm })) {
    return fail('FORBIDDEN', 'You do not have permission to update this student.');
  }
  return { ok: true, student };
}

const CONFLICT = () => fail('CONFLICT_VERSION_MISMATCH', 'This record changed before the change could be saved. Sync and try again.');

async function applyLeave({ studentId, auth, leaveType, reason, basedOnVersion }) {
  if (!ADMIN_ROLES.includes(auth.role)) return fail('FORBIDDEN', 'Only the Principal or Director can record a leave.');
  const loaded = await loadScopedStudent(studentId, auth);
  if (!loaded.ok) return loaded;

  const plan = planLeave(loaded.student, { leaveType, reason });
  if (!plan.ok) return fail(plan.code, plan.message);

  const previousStatus = loaded.student.status;
  const row = await db.withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE students SET status = $3, sync_version = sync_version + 1, updated_at = now()
        WHERE id = $1 AND sync_version = $2
        RETURNING id, status, sync_version`,
      [studentId, basedOnVersion, plan.changes.status]
    );
    if (updated.rows.length === 0) return null;
    await client.query(
      `INSERT INTO student_leaves (student_id, leave_type, leave_session, reason, recorded_by, previous_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [studentId, plan.record.leave_type, plan.record.leave_session, plan.record.reason, auth.userId, previousStatus]
    );
    return updated.rows[0];
  });
  if (!row) return CONFLICT();

  return { ok: true, student: row, audit: {
    action: 'STUDENT_LEAVE_RECORDED',
    metadata: { leaveType: plan.record.leave_type, session: plan.record.leave_session, previousStatus },
  } };
}

async function applyEntranceOutcome({ studentId, auth, outcome, basedOnVersion }) {
  if (!ADMIN_ROLES.includes(auth.role)) return fail('FORBIDDEN', 'Only the Principal or Director can record an entrance result.');
  if (!['admitted', 'not_admitted'].includes(outcome)) return fail('VALIDATION_ERROR', 'Choose admitted or not admitted.');
  const loaded = await loadScopedStudent(studentId, auth);
  if (!loaded.ok) return loaded;
  if (loaded.student.class_level !== 'Primary 5') {
    return fail('NOT_PRIMARY_5', 'An entrance outcome can only be recorded for a Primary 5 pupil.');
  }

  const { rows } = await db.query(
    `UPDATE students SET entrance_outcome = $3, sync_version = sync_version + 1, updated_at = now()
      WHERE id = $1 AND sync_version = $2 AND class_level = 'Primary 5'
      RETURNING id, status, sync_version`,
    [studentId, basedOnVersion, outcome]
  );
  if (rows.length === 0) return CONFLICT();

  return { ok: true, student: rows[0], audit: {
    action: 'STUDENT_ENTRANCE_OUTCOME_RECORDED', metadata: { outcome },
  } };
}

/** action: 'inactive' | 'clear_inactive' */
async function applyStatusChange({ studentId, auth, action, reason, basedOnVersion }) {
  if (!ADMIN_ROLES.includes(auth.role)) return fail('FORBIDDEN', 'Only the Principal or Director can change this status.');
  const loaded = await loadScopedStudent(studentId, auth);
  if (!loaded.ok) return loaded;
  const current = loaded.student;

  let toStatus;
  let eventReason = null;
  let auditAction;
  if (action === 'inactive') {
    if (current.status === 'inactive') return fail('ALREADY_INACTIVE', 'This student is already marked Inactive.');
    if (!INACTIVE_FROM.includes(current.status)) {
      return fail('CANNOT_MARK_INACTIVE', `This student's status is ${current.status} and cannot be marked Inactive.`);
    }
    const why = typeof reason === 'string' ? reason.trim() : '';
    if (why.length < 3 || why.length > 300) return fail('VALIDATION_ERROR', 'Give a reason of 3 to 300 characters.');
    toStatus = 'inactive';
    eventReason = why;
    auditAction = 'STUDENT_MARKED_INACTIVE';
  } else if (action === 'clear_inactive') {
    if (current.status !== 'inactive') return fail('NOT_INACTIVE', 'This student is not marked Inactive.');
    toStatus = 'active';
    auditAction = 'STUDENT_INACTIVE_CLEARED';
  } else {
    return fail('VALIDATION_ERROR', 'Unknown status change.');
  }

  const row = await db.withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE students SET status = $3, sync_version = sync_version + 1, updated_at = now()
        WHERE id = $1 AND sync_version = $2
        RETURNING id, status, sync_version`,
      [studentId, basedOnVersion, toStatus]
    );
    if (updated.rows.length === 0) return null;
    await client.query(
      `INSERT INTO student_status_events (student_id, from_status, to_status, reason, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [studentId, current.status, toStatus, eventReason, auth.userId]
    );
    return updated.rows[0];
  });
  if (!row) return CONFLICT();

  return { ok: true, student: row, audit: { action: auditAction, metadata: { previousStatus: current.status } } };
}

/** Runs one queued student action from /sync. */
async function handleStudentActionOperation({ operation, userId, userRole, deviceId, syncOpRowId, markStatus }) {
  const auth = { userId, role: userRole, deviceId };
  const { operationId, opType, entityId } = operation;
  const p = operation.payload || {};

  if (!Number.isInteger(p.basedOnVersion) || p.basedOnVersion < 1) {
    const message = 'The change is missing the record version.';
    await markStatus(syncOpRowId, 'failed', message);
    return { operationId, status: 'failed', error: 'VALIDATION_ERROR', message };
  }

  let result;
  if (opType === 'student_leave') {
    result = await applyLeave({ studentId: entityId, auth, leaveType: p.leaveType, reason: p.reason, basedOnVersion: p.basedOnVersion });
  } else if (opType === 'entrance_outcome') {
    result = await applyEntranceOutcome({ studentId: entityId, auth, outcome: p.outcome, basedOnVersion: p.basedOnVersion });
  } else {
    result = await applyStatusChange({ studentId: entityId, auth, action: p.action, reason: p.reason, basedOnVersion: p.basedOnVersion });
  }

  if (!result.ok) {
    await markStatus(syncOpRowId, 'failed', result.message);
    return { operationId, status: 'failed', error: result.code, message: result.message };
  }

  await markStatus(syncOpRowId, 'synced');
  await writeAudit({
    userId, deviceId, action: result.audit.action, entityType: 'student', entityId,
    result: 'success', metadata: result.audit.metadata,
  });
  return { operationId, status: 'synced' };
}

module.exports = { applyLeave, applyEntranceOutcome, applyStatusChange, handleStudentActionOperation };

'use strict';

const db = require('../db');
const { validate: isUuid } = require('uuid');
const { writeAudit } = require('../middleware/audit');
const {
  validateReport,
  canWriteAbout,
  EDIT_WINDOW_HOURS,
} = require('../utils/staffReportRules');
const { getScopeForUser } = require('./studentScopeService');

const WRITE_ROLES = ['principal', 'head_teacher'];
const ALLOWED_KEYS = ['action', 'subjectId', 'score', 'comment', 'recognition', 'reportMonth'];

function fail(code, message) {
  return { ok: false, code, message };
}

async function loadSubject(subjectId) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.role, u.status,
            cta.division, cta.class_level, cta.arm
       FROM users u
       LEFT JOIN class_teacher_assignments cta ON cta.user_id = u.id
      WHERE u.id = $1`,
    [subjectId]
  );

  return rows[0] || null;
}

async function checkWriterCanWrite({ userId, userRole, subject }) {
  if (!WRITE_ROLES.includes(userRole)) {
    return fail('FORBIDDEN', 'Only the Principal or an authorised Head Teacher can write staff reports.');
  }

  const scope = userRole === 'head_teacher'
    ? await getScopeForUser({ role: userRole, userId })
    : [];

  const divisions = [...new Set((scope || []).map((item) => item.division))];

  if (!canWriteAbout({
    writerRole: userRole,
    writerId: userId,
    writerDivisions: divisions,
    subject,
  })) {
    return fail(
      'FORBIDDEN',
      'You can write reports only about active staff members within your responsibility.'
    );
  }

  return { ok: true };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return fail('VALIDATION_ERROR', 'The staff report payload is invalid.');
  }

  if (Object.keys(payload).some((key) => !ALLOWED_KEYS.includes(key))) {
    return fail('VALIDATION_ERROR', 'The staff report contains unsupported fields.');
  }

  // Reconciliation metadata only. Never use this value to assign report_month.
  if (
    payload.reportMonth !== undefined &&
    (typeof payload.reportMonth !== 'string' ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(payload.reportMonth))
  ) {
    return fail('VALIDATION_ERROR', 'The report month metadata is invalid.');
  }

  if (!['create', 'correct'].includes(payload.action)) {
    return fail('VALIDATION_ERROR', 'Choose a valid staff report action.');
  }

  if (typeof payload.subjectId !== 'string' || !isUuid(payload.subjectId)) {
    return fail('VALIDATION_ERROR', 'A staff member must be selected.');
  }

  const checked = validateReport(payload);

  return checked.ok ? { ok: true, value: checked.value } : checked;
}

async function applyCreate({ operation, userId, userRole, deviceId }) {
  const { entityId, payload } = operation;

  if (typeof entityId !== 'string' || !isUuid(entityId)) {
    return fail('VALIDATION_ERROR', 'The report identifier is invalid.');
  }

  const checked = validatePayload(payload);
  if (!checked.ok) return checked;

  const subject = await loadSubject(payload.subjectId);
  if (!subject) return fail('NOT_FOUND', 'That staff member could not be found.');

  const permission = await checkWriterCanWrite({ userId, userRole, subject });
  if (!permission.ok) return permission;

  try {
    const { rows } = await db.query(
      `WITH server_time AS (
         SELECT now() AS written_at
       )
       INSERT INTO staff_reports
         (id, subject_id, subject_division, report_month,
          score, comment, recognition, written_by, written_at)
       SELECT
         $1, $2, $3,
         to_char(
           (server_time.written_at AT TIME ZONE 'Africa/Lagos')::date,
           'YYYY-MM'
         ),
         $4, $5, $6, $7, server_time.written_at
       FROM server_time
       ON CONFLICT (id) DO NOTHING
       RETURNING id, report_month`,
      [
        entityId,
        subject.id,
        subject.division,
        checked.value.score,
        checked.value.comment,
        checked.value.recognition,
        userId,
      ]
    );

    if (!rows[0]) {
      const { rows: existingById } = await db.query(
        'SELECT id, subject_id, written_by, report_month FROM staff_reports WHERE id = $1',
        [entityId]
      );

      if (
        !existingById[0] ||
        existingById[0].subject_id !== subject.id ||
        existingById[0].written_by !== userId
      ) {
        return fail('REPORT_ID_COLLISION', 'This report identifier is already in use.');
      }

      return { ok: true, alreadyApplied: true, reportMonth: existingById[0].report_month };
    }

    await writeAudit({
      userId,
      deviceId,
      action: 'STAFF_REPORT_CREATED',
      entityType: 'staff_report',
      entityId,
      result: 'success',
      metadata: {
        reportMonth: rows[0].report_month,
        score: checked.value.score,
      },
    });

    return { ok: true, reportMonth: rows[0].report_month };
  } catch (err) {
    if (err && err.code === '23505') {
      return fail(
        'REPORT_EXISTS',
        'A report for this person already exists for the current school month.'
      );
    }

    throw err;
  }
}

async function applyCorrection({ operation, userId, userRole, deviceId }) {
  const { entityId, payload } = operation;

  if (typeof entityId !== 'string' || !isUuid(entityId)) {
    return fail('VALIDATION_ERROR', 'The report identifier is invalid.');
  }

  const checked = validatePayload(payload);
  if (!checked.ok) return checked;

  const { rows: found } = await db.query(
    `SELECT id, subject_id, written_by
       FROM staff_reports
      WHERE id = $1`,
    [entityId]
  );

  const report = found[0];

  if (!report) {
    return fail('NOT_FOUND', 'That report could not be found.');
  }

  const subject = await loadSubject(payload.subjectId);
  if (!subject) return fail('NOT_FOUND', 'That staff member could not be found.');

  const stillAllowed = await checkWriterCanWrite({ userId, userRole, subject });
  if (!stillAllowed.ok) return stillAllowed;

  if (report.subject_id !== payload.subjectId) {
    return fail(
      'VALIDATION_ERROR',
      'The report does not belong to the selected staff member.'
    );
  }

  if (report.written_by !== userId) {
    return fail(
      'FORBIDDEN',
      'Only the person who wrote this report can correct it.'
    );
  }

  if (!WRITE_ROLES.includes(userRole)) {
    return fail('FORBIDDEN', 'You are not allowed to correct staff reports.');
  }

  const { rows } = await db.query(
    `UPDATE staff_reports
        SET original_comment = COALESCE(original_comment, comment),
            score = $2,
            comment = $3,
            recognition = $4,
            corrected_at = now(),
            correction_count = correction_count + 1
      WHERE id = $1
        AND written_by = $5
        AND now() >= written_at
        AND now() <= written_at + make_interval(hours => $6)
      RETURNING correction_count`,
    [
      entityId,
      checked.value.score,
      checked.value.comment,
      checked.value.recognition,
      userId,
      EDIT_WINDOW_HOURS,
    ]
  );

  if (!rows[0]) {
    return fail(
      'WINDOW_CLOSED',
      `Reports can be corrected only within ${EDIT_WINDOW_HOURS} hours of being written.`
    );
  }

  await writeAudit({
    userId,
    deviceId,
    action: 'STAFF_REPORT_CORRECTED',
    entityType: 'staff_report',
    entityId,
    result: 'success',
    metadata: {
      score: checked.value.score,
      correctionCount: rows[0].correction_count,
    },
  });

  return { ok: true };
}

async function handleStaffReportOperation({
  operation,
  userId,
  userRole,
  deviceId,
  syncOpRowId,
  markStatus,
}) {
  const { operationId, payload } = operation;

  const result = payload && payload.action === 'create'
    ? await applyCreate({ operation, userId, userRole, deviceId })
    : await applyCorrection({ operation, userId, userRole, deviceId });

  if (!result.ok) {
    await markStatus(syncOpRowId, 'failed', result.message);

    return {
      operationId,
      status: 'failed',
      error: result.code,
      message: result.message,
    };
  }

  await markStatus(syncOpRowId, 'synced');

  return {
    operationId,
    status: 'synced',
    alreadyApplied: !!result.alreadyApplied,
    reportMonth: result.reportMonth || null,
  };
}

module.exports = { handleStaffReportOperation };

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

const router = express.Router();

const ADMIN_ROLES = ['principal', 'director'];
// Statuses a student can be marked Inactive from.
const INACTIVE_FROM = ['registered', 'active', 'promoted'];
const LEAVER_STATUSES = ['graduated', 'transferred', 'withdrawn', 'expelled', 'deceased', 'not_admitted'];

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

async function loadStudent(id) {
  const { rows } = await db.query(
    'SELECT id, full_name, status, sync_version FROM students WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

// Writes the new status only if the phone's version is still current. Returns null on a version mismatch.
async function setStatus(client, studentId, basedOnVersion, status) {
  const { rows } = await client.query(
    `UPDATE students
        SET status = $3, sync_version = sync_version + 1, updated_at = now()
      WHERE id = $1 AND sync_version = $2
      RETURNING id, status, sync_version`,
    [studentId, basedOnVersion, status]
  );
  return rows[0] || null;
}

async function recordEvent(client, { studentId, fromStatus, toStatus, reason, userId }) {
  await client.query(
    `INSERT INTO student_status_events (student_id, from_status, to_status, reason, changed_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [studentId, fromStatus, toStatus, reason || null, userId]
  );
}

function versionConflict() {
  return Errors.conflict(
    'CONFLICT_VERSION_MISMATCH',
    'This record changed before the change could be saved. Refresh and try again.'
  );
}

/**
 * POST /student-status/:id/inactive   body { basedOnVersion, reason }
 * Principal and Director only. The student stays on the roll, labelled Inactive.
 */
router.post(
  '/:id/inactive',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  [
    param('id').isUUID(),
    body('basedOnVersion').isInt({ min: 1 }),
    body('reason').isString().trim().isLength({ min: 3, max: 300 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const student = await loadStudent(req.params.id);
      if (!student) throw Errors.notFound('That student could not be found.');
      if (student.status === 'inactive') {
        throw Errors.badRequest('ALREADY_INACTIVE', 'This student is already marked Inactive.');
      }
      if (!INACTIVE_FROM.includes(student.status)) {
        throw Errors.badRequest(
          'CANNOT_MARK_INACTIVE',
          `This student's status is ${student.status} and cannot be marked Inactive.`
        );
      }

      const reason = req.body.reason.trim();
      const updated = await db.withTransaction(async (client) => {
        const row = await setStatus(client, student.id, req.body.basedOnVersion, 'inactive');
        if (!row) return null;
        await recordEvent(client, {
          studentId: student.id,
          fromStatus: student.status,
          toStatus: 'inactive',
          reason,
          userId: req.auth.userId,
        });
        return row;
      });
      if (!updated) throw versionConflict();

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STUDENT_MARKED_INACTIVE',
        entityType: 'student',
        entityId: student.id,
        result: 'success',
        metadata: { previousStatus: student.status },
      });

      return res.json({ student: updated });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /student-status/:id/clear-inactive   body { basedOnVersion }
 * Principal and Director only. The student goes back to Active.
 */
router.post(
  '/:id/clear-inactive',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  [param('id').isUUID(), body('basedOnVersion').isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const student = await loadStudent(req.params.id);
      if (!student) throw Errors.notFound('That student could not be found.');
      if (student.status !== 'inactive') {
        throw Errors.badRequest('NOT_INACTIVE', 'This student is not marked Inactive.');
      }

      const updated = await db.withTransaction(async (client) => {
        const row = await setStatus(client, student.id, req.body.basedOnVersion, 'active');
        if (!row) return null;
        await recordEvent(client, {
          studentId: student.id,
          fromStatus: 'inactive',
          toStatus: 'active',
          reason: null,
          userId: req.auth.userId,
        });
        return row;
      });
      if (!updated) throw versionConflict();

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STUDENT_INACTIVE_CLEARED',
        entityType: 'student',
        entityId: student.id,
        result: 'success',
      });

      return res.json({ student: updated });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /student-status/:id/undo-leave   body { basedOnVersion }
 * Principal and Director only. Restores the status from before the most recent leave.
 * The leave record is kept and marked undone, so the history stays complete.
 */
router.post(
  '/:id/undo-leave',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  [param('id').isUUID(), body('basedOnVersion').isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const student = await loadStudent(req.params.id);
      if (!student) throw Errors.notFound('That student could not be found.');
      if (!LEAVER_STATUSES.includes(student.status)) {
        throw Errors.badRequest('NOT_LEFT', 'This student has not left, so there is no leave to undo.');
      }

      const { rows: leaves } = await db.query(
        `SELECT id, leave_type, previous_status
           FROM student_leaves
          WHERE student_id = $1 AND undone_at IS NULL
          ORDER BY recorded_at DESC
          LIMIT 1`,
        [student.id]
      );
      const leave = leaves[0];
      if (!leave || leave.leave_type !== student.status) {
        throw Errors.badRequest('NO_LEAVE_TO_UNDO', 'There is no recorded leave to undo for this student.');
      }
      // Leaves recorded before this step have no previous status. They return to Active.
      const restoreTo = leave.previous_status || 'active';

      const updated = await db.withTransaction(async (client) => {
        const row = await setStatus(client, student.id, req.body.basedOnVersion, restoreTo);
        if (!row) return null;
        await client.query(
          'UPDATE student_leaves SET undone_at = now(), undone_by = $2 WHERE id = $1',
          [leave.id, req.auth.userId]
        );
        await recordEvent(client, {
          studentId: student.id,
          fromStatus: student.status,
          toStatus: restoreTo,
          reason: 'Leave undone',
          userId: req.auth.userId,
        });
        return row;
      });
      if (!updated) throw versionConflict();

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STUDENT_LEAVE_UNDONE',
        entityType: 'student',
        entityId: student.id,
        result: 'success',
        metadata: { leaveType: leave.leave_type, restoredTo: restoreTo },
      });

      return res.json({ student: updated });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

const express = require('express');
const { param, query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { STAFF_ROLES } = require('../utils/biodataApproval');
const {
  checkStudentInScope,
  applyBiodataSave,
  getBiodataChanges,
  OUT_COLUMNS,
} = require('../services/biodataService');

const router = express.Router();

const MAX_LIMIT = 200;
const EPOCH = '1970-01-01T00:00:00.000Z';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
}

function throwFor(result) {
  if (result.code === 'NOT_FOUND') throw Errors.notFound(result.message);
  if (result.code === 'FORBIDDEN' || result.code === 'NOT_EDITABLE') throw Errors.forbidden(result.message);
  throw Errors.badRequest(result.code, result.message);
}

/**
 * GET /student-biodata/changes?since=<ISO>&afterId=<uuid>&limit=<n>
 * Change feed for phones. Must be defined before GET /:id.
 */
router.get(
  '/changes',
  requireAuth,
  requireRole(...STAFF_ROLES),
  [
    query('since').optional().isISO8601(),
    query('afterId').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await getBiodataChanges({
        auth: req.auth,
        since: req.query.since || EPOCH,
        afterId: req.query.afterId || ZERO_UUID,
        limit: parseInt(req.query.limit || String(MAX_LIMIT), 10),
      });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

/** GET /student-biodata/:id */
router.get(
  '/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const scoped = await checkStudentInScope(req.params.id, req.auth);
      if (!scoped.ok) throwFor(scoped);

      const { rows } = await db.query(
        `SELECT ${OUT_COLUMNS}, updated_at FROM student_biodata WHERE student_id = $1`,
        [req.params.id]
      );

      await writeAudit({
        userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'STUDENT_BIODATA_VIEWED',
        entityType: 'student', entityId: req.params.id, result: 'success',
      });

      if (rows.length === 0) {
        const empty = {};
        require('../utils/biodataRules').FIELD_NAMES.forEach((f) => { empty[f] = null; });
        empty.nationality = 'Nigerian';
        return res.json({ biodata: empty, exists: false });
      }
      return res.json({ biodata: rows[0], exists: true });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /student-biodata/:id
 * Same rules as the sync queue: a Class Teacher's save is Pending, an approver's is Approved.
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await applyBiodataSave({
        studentId: req.params.id,
        auth: req.auth,
        fields: req.body,
      });
      if (!result.ok) throwFor(result);

      await writeAudit({
        userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'STUDENT_BIODATA_UPDATED',
        entityType: 'student', entityId: req.params.id, result: 'success',
        metadata: { fields: result.fields },
      });

      return res.json({ biodata: result.row, exists: true });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

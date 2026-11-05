const express = require('express');
const { param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { getScopeForUser, isWithinScope } = require('../services/studentScopeService');
const { FIELD_NAMES, validateBiodata } = require('../utils/biodataRules');

const router = express.Router();

// Staff only. Guests have no route to this table.
const STAFF_ROLES = ['director', 'principal', 'head_teacher', 'class_teacher'];

// Column list is built from the fixed field list, never from request input.
const OUT_COLUMNS = FIELD_NAMES
  .map((f) => (f === 'admission_date' ? "to_char(admission_date, 'YYYY-MM-DD') AS admission_date" : f))
  .join(', ');

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
}

// Loads the student and refuses anyone outside their class scope.
async function loadStudentInScope(req) {
  const { rows } = await db.query(
    'SELECT id, division, class_level, arm FROM students WHERE id = $1',
    [req.params.id]
  );
  const student = rows[0];
  if (!student) throw Errors.notFound('That student could not be found.');

  const scope = await getScopeForUser(req.auth);
  if (!isWithinScope(scope, { division: student.division, classLevel: student.class_level, arm: student.arm })) {
    throw Errors.forbidden('You do not have permission to open this student\'s biodata.');
  }
  return student;
}

/** GET /student-biodata/:id */
router.get(
  '/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      await loadStudentInScope(req);

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
        FIELD_NAMES.forEach((f) => { empty[f] = null; });
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
 * Body: any of the biodata fields. Only the fields sent are changed.
 * A field sent as null or "" is cleared. The row is created on the first save.
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      await loadStudentInScope(req);

      const edit = validateBiodata(req.body);
      if (!edit.ok) throw Errors.badRequest(edit.code, edit.message);

      const cols = Object.keys(edit.changes);
      const values = cols.map((c) => edit.changes[c]);
      const placeholders = cols.map((_, i) => `$${i + 3}`).join(', ');
      const updates = cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');

      const { rows } = await db.query(
        `INSERT INTO student_biodata (student_id, updated_by, ${cols.join(', ')})
         VALUES ($1, $2, ${placeholders})
         ON CONFLICT (student_id) DO UPDATE
           SET ${updates}, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING ${OUT_COLUMNS}, updated_at`,
        [req.params.id, req.auth.userId, ...values]
      );

      // Field names only. Health and contact values never go into the audit log.
      await writeAudit({
        userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'STUDENT_BIODATA_UPDATED',
        entityType: 'student', entityId: req.params.id, result: 'success',
        metadata: { fields: cols },
      });

      return res.json({ biodata: rows[0], exists: true });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

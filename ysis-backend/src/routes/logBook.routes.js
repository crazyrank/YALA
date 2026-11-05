const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { getScopeForUser, scopeToSqlClause } = require('../services/studentScopeService');
const {
  DATE_PATTERN,
  EDIT_WINDOW_HOURS,
  validateNewEntry,
  validateCorrection,
} = require('../utils/logBookRules');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

// Columns returned for every entry. Dates are text so no timezone shifts them.
const ENTRY_COLUMNS = `id, division, class_level, arm,
  to_char(entry_date, 'YYYY-MM-DD') AS entry_date,
  body, original_body, written_by, written_at, corrected_at, correction_count`;

/**
 * POST /log-entries   body { entryDate, body }
 * Class Teacher only. The class comes from the Class Teacher's one assignment.
 */
router.post(
  '/',
  requireAuth,
  requireRole('class_teacher'),
  [body('entryDate').isString(), body('body').isString()],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const { rows: assignments } = await db.query(
        'SELECT division, class_level, arm FROM class_teacher_assignments WHERE user_id = $1',
        [req.auth.userId]
      );
      const assignment = assignments[0];
      if (!assignment) {
        throw Errors.forbidden('You have no class assigned yet. Ask the Principal to assign one.');
      }

      const { rows: todayRows } = await db.query(
        `SELECT to_char((now() AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS today`
      );
      const checked = validateNewEntry({
        entryDate: req.body.entryDate,
        body: req.body.body,
        today: todayRows[0].today,
      });
      if (!checked.ok) throw Errors.badRequest(checked.code, checked.message);

      const { rows } = await db.query(
        `INSERT INTO log_entries (division, class_level, arm, entry_date, body, written_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${ENTRY_COLUMNS}`,
        [
          assignment.division,
          assignment.class_level,
          assignment.arm,
          checked.value.entryDate,
          checked.value.body,
          req.auth.userId,
        ]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'LOG_ENTRY_CREATED',
        entityType: 'log_entry',
        entityId: rows[0].id,
        result: 'success',
        metadata: { classLevel: assignment.class_level, entryDate: checked.value.entryDate },
      });

      return res.status(201).json({ entry: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /log-entries/:id   body { body }
 * The writer only, and only within the correction window. The first text is kept.
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('class_teacher'),
  [param('id').isUUID(), body('body').isString()],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const { rows: found } = await db.query(
        `SELECT ${ENTRY_COLUMNS},
                (now() - written_at) <= make_interval(hours => $2) AS within_window
           FROM log_entries
          WHERE id = $1`,
        [req.params.id, EDIT_WINDOW_HOURS]
      );
      const entry = found[0];
      if (!entry) throw Errors.notFound('That entry could not be found.');
      if (entry.written_by !== req.auth.userId) {
        throw Errors.forbidden('Only the person who wrote this entry can correct it.');
      }
      if (!entry.within_window) {
        throw Errors.forbidden(`Entries can be corrected only within ${EDIT_WINDOW_HOURS} hours of being written.`);
      }

      const checked = validateCorrection({ body: req.body.body });
      if (!checked.ok) throw Errors.badRequest(checked.code, checked.message);

      const { rows } = await db.query(
        `UPDATE log_entries
            SET original_body = COALESCE(original_body, body),
                body = $2,
                corrected_at = now(),
                correction_count = correction_count + 1
          WHERE id = $1
          RETURNING ${ENTRY_COLUMNS}`,
        [req.params.id, checked.value.body]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'LOG_ENTRY_CORRECTED',
        entityType: 'log_entry',
        entityId: req.params.id,
        result: 'success',
        metadata: { correctionCount: rows[0].correction_count },
      });

      return res.json({ entry: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /log-entries?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N
 * Newest first. Each caller sees only the classes inside their own scope.
 */
router.get(
  '/',
  requireAuth,
  [
    query('from').optional().matches(DATE_PATTERN),
    query('to').optional().matches(DATE_PATTERN),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      if (req.auth.role === 'guest') {
        throw Errors.forbidden('Guests cannot open the Log Book.');
      }

      const from = req.query.from || '2000-01-01';
      const to = req.query.to || '2100-12-31';
      const limit = parseInt(req.query.limit || '100', 10);

      const scope = await getScopeForUser(req.auth);
      const params = [from, to];
      const conditions = ['entry_date BETWEEN $1::date AND $2::date'];
      let idx = 3;

      if (scope !== null) {
        const { clause, params: scopeParams } = scopeToSqlClause(scope, idx);
        conditions.push(clause);
        params.push(...scopeParams);
        idx += scopeParams.length;
      }

      params.push(limit);
      const { rows } = await db.query(
        `SELECT ${ENTRY_COLUMNS},
                (SELECT u.full_name FROM users u WHERE u.id = log_entries.written_by) AS written_by_name
           FROM log_entries
          WHERE ${conditions.join(' AND ')}
          ORDER BY entry_date DESC, written_at DESC
          LIMIT $${idx}`,
        params
      );

      return res.json({ entries: rows });
    } catch (err) {
      return next(err);
    }
  }
);

const { getLogChanges } = require('../services/logBookService');

/**
 * GET /log-entries/changes?since=<ISO>&afterId=<uuid>&limit=<n>
 * Phone sync feed. Staff only (guests cannot open the Log Book).
 */
router.get(
  '/changes',
  requireAuth,
  requireRole('director', 'principal', 'head_teacher', 'class_teacher'),
  [
    query('since').optional().isISO8601(),
    query('afterId').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await getLogChanges({
        auth: req.auth,
        since: req.query.since || '1970-01-01T00:00:00.000Z',
        afterId: req.query.afterId || '00000000-0000-0000-0000-000000000000',
        limit: parseInt(req.query.limit || '200', 10),
      });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

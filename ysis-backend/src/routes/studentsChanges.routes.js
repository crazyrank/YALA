const express = require('express');
const { query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { Errors } = require('../utils/errors');
const {
  getScopeForUser,
  scopeToSqlClause,
} = require('../services/studentScopeService');

const router = express.Router();

const MAX_LIMIT = 200;
const EPOCH = '1970-01-01T00:00:00.000Z';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * GET /students/changes?since=<ISO>&afterId=<uuid>&limit=<n>
 * Returns students changed after the cursor, oldest change first.
 * Paging uses (updated_at, id) so no student is skipped when two
 * students share the same timestamp.
 */
router.get(
  '/',
  requireAuth,
  [
    query('since').optional().isISO8601(),
    query('afterId').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }),
  ],
  async (req, res, next) => {
    try {
      const check = validationResult(req);
      if (!check.isEmpty()) {
        throw Errors.badRequest('VALIDATION_ERROR', check.array()[0].msg);
      }

      const since = req.query.since || EPOCH;
      const afterId = req.query.afterId || ZERO_UUID;
      const limit = parseInt(req.query.limit || String(MAX_LIMIT), 10);

      const scope = await getScopeForUser(req.auth);

      const params = [since, afterId];
      const conditions = ['(updated_at, id) > ($1::timestamptz, $2::uuid)'];
      let idx = 3;

      if (scope !== null) {
        const { clause, params: scopeParams } = scopeToSqlClause(scope, idx);
        conditions.push(clause);
        params.push(...scopeParams);
        idx += scopeParams.length;
      }

      // One extra row tells us whether another page exists.
      params.push(limit + 1);

      const { rows } = await db.query(
        `SELECT id,
                admission_no,
                full_name,
                division,
                class_level,
                arm,
                academic_session,
                created_at,
                status,
                sync_version,
                to_char(updated_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
         FROM students
         WHERE ${conditions.join(' AND ')}
         ORDER BY updated_at ASC, id ASC
         LIMIT $${idx}`,
        params
      );

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page[page.length - 1];

      const students = page.map(({ cursor_ts, ...student }) => student);

      return res.json({
        students,
        hasMore,
        nextCursor: last
          ? { since: last.cursor_ts, afterId: last.id }
          : { since, afterId },
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

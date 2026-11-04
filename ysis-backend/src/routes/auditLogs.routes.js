const express = require('express');
const { query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { Errors } = require('../utils/errors');

const router = express.Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /audit-logs?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=UUID&limit=N
 * Principal and Director only. Newest first.
 * userId matches entries the person made and entries about that person.
 * Dates use the school's time zone (Africa/Lagos).
 */
router.get(
  '/',
  requireAuth,
  requireRole('principal', 'director'),
  [
    query('from').optional().matches(DATE_PATTERN),
    query('to').optional().matches(DATE_PATTERN),
    query('userId').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 500 }),
  ],
  async (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);

      const from = req.query.from || '2000-01-01';
      const to = req.query.to || '2100-12-31';
      const limit = parseInt(req.query.limit || '200', 10);

      const params = [from, to];
      let personClause = '';
      if (req.query.userId) {
        params.push(req.query.userId);
        personClause = 'AND (a.user_id = $3 OR a.entity_id = $3)';
      }
      params.push(limit);

      const { rows } = await db.query(
        `SELECT a.id, a.occurred_at, a.action, a.result, a.entity_type, a.entity_id, a.metadata,
                u.full_name AS user_name
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.user_id
          WHERE (a.occurred_at AT TIME ZONE 'Africa/Lagos')::date BETWEEN $1::date AND $2::date
            ${personClause}
          ORDER BY a.occurred_at DESC
          LIMIT $${params.length}`,
        params
      );

      return res.json({
        entries: rows.map((r) => ({
          id: String(r.id),
          occurredAt: r.occurred_at,
          action: r.action,
          result: r.result,
          userName: r.user_name || null,
          entityType: r.entity_type,
          entityId: r.entity_id,
          metadata: r.metadata,
        })),
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

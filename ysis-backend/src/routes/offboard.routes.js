const express = require('express');
const { param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { notifyDirectors } = require('../services/alerts');

const router = express.Router();

// Same ownership rule as PATCH /users/:id/status
const CREATABLE_ROLE_BY_CALLER = { director: 'principal', principal: 'head_teacher' };

/**
 * POST /users/:id/offboard
 * Suspend a staff account and revoke all its devices in one step.
 */
router.post(
  '/:id/offboard',
  requireAuth,
  requireRole('director', 'principal'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);

      const { id } = req.params;
      const { rows } = await db.query(
        'SELECT id, role, created_by, full_name FROM users WHERE id = $1',
        [id]
      );
      const target = rows[0];
      if (!target) throw Errors.notFound('That account could not be found.');

      const ownsTarget =
        target.role === CREATABLE_ROLE_BY_CALLER[req.auth.role] &&
        target.created_by === req.auth.userId;
      if (!ownsTarget) throw Errors.forbidden('You are not able to manage this account.');

      // Suspend first and bump session_version so existing tokens stop working at once.
      await db.query(
        `UPDATE users SET status = 'suspended', session_version = session_version + 1, updated_at = now()
         WHERE id = $1`,
        [id]
      );
      const revoked = await db.query(
        `UPDATE devices SET status = 'revoked', revoked_at = now(), revoked_by = $2, refresh_token_hash = NULL
         WHERE user_id = $1 AND status <> 'revoked' RETURNING id`,
        [id, req.auth.userId]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STAFF_OFFBOARDED',
        entityType: 'user',
        entityId: id,
        result: 'success',
        metadata: { devicesRevoked: revoked.rowCount },
      });
      notifyDirectors({
        title: 'Staff offboarded',
        body: `${target.full_name} was suspended and ${revoked.rowCount} device(s) were revoked.`,
        entityId: id,
      });

      return res.json({ ok: true, devicesRevoked: revoked.rowCount });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

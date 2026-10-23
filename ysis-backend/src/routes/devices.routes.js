const { notifyDirectors } = require('../services/alerts');
const express = require('express');
const { param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
}

/** GET /devices/pending-count — number of devices waiting for approval. Principal/Director only. */
router.get('/pending-count', requireAuth, requireRole('principal', 'director'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      "SELECT COUNT(*)::int AS count FROM devices WHERE status = 'pending_verification'"
    );
    return res.json({ count: rows[0]?.count || 0 });
  } catch (err) {
    return next(err);
  }
});

/** GET /devices — Principal/Director see all, others see only their own */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.auth.role === 'principal' || req.auth.role === 'director';
    const { rows } = await db.query(
      isAdmin
        ? `SELECT d.id, d.user_id, d.device_name, d.status, d.registered_at, d.last_seen_at, d.revoked_at, d.revoked_by, d.last_login_ip, d.last_login_at, u.full_name, u.role FROM devices d JOIN users u ON u.id = d.user_id ORDER BY d.last_seen_at DESC NULLS LAST`
        : `SELECT id, user_id, device_name, status, registered_at, last_seen_at, revoked_at, revoked_by, last_login_ip, last_login_at FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC NULLS LAST`,
      isAdmin ? [] : [req.auth.userId]
    );
    return res.json({ devices: rows });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /devices/:id/approve
 * Principal/Director trust a pending device. Matches architecture:
 * new devices register, but only become trusted after admin oversight
 * (except the very first device for a user, which is auto-trusted at login).
 */
router.post(
  '/:id/approve',
  requireAuth,
  requireRole('principal', 'director'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { rows } = await db.query(
        `UPDATE devices SET status = 'trusted', last_seen_at = now()
         WHERE id = $1 AND status = 'pending_verification'
         RETURNING id, user_id, device_name, status, registered_at, last_seen_at, revoked_at, revoked_by, last_login_ip, last_login_at`,
        [req.params.id]
      );
      if (rows.length === 0) {
        throw Errors.notFound('Device not found or already trusted/revoked.');
      }

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'DEVICE_APPROVED',
        entityType: 'device',
        entityId: req.params.id,
        result: 'success',
      });

      notifyDirectors({ title: 'Device approved', body: 'A device was approved for an account.', entityId: rows[0].id });
      return res.json({ device: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

/** DELETE /devices/:id — remote revocation. Lost/damaged phone scenario. */
router.delete(
  '/:id',
  requireAuth,
  requireRole('principal', 'director'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { rows } = await db.query(
        `UPDATE devices SET status = 'revoked', revoked_at = now(), revoked_by = $2,
               refresh_token_hash = NULL
         WHERE id = $1 RETURNING id`,
        [req.params.id, req.auth.userId]
      );
      if (rows.length === 0) throw Errors.notFound();

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'DEVICE_REVOKED',
        entityType: 'device',
        entityId: req.params.id,
        result: 'success',
      });

      notifyDirectors({ title: 'Device revoked', body: 'A device was revoked.', entityId: rows[0].id });
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

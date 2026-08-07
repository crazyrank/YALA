const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
}

/** POST /permissions/delegate — Principal only, reason mandatory */
router.post(
  '/delegate',
  requireAuth,
  requireRole('principal'),
  [
    body('userId').isUUID(),
    body('permissionCode').isString().notEmpty(),
    body('expiresInHours').isInt({ min: 1, max: 168 }),
    body('reason').isString().isLength({ min: 5 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { userId, permissionCode, expiresInHours, reason } = req.body;

      const perm = await db.query('SELECT id FROM permissions WHERE code = $1', [permissionCode]);
      if (perm.rows.length === 0) throw Errors.badRequest('UNKNOWN_PERMISSION', 'That permission does not exist.');

      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
      const { rows } = await db.query(
        `INSERT INTO user_permissions (user_id, permission_id, granted_by, reason, expires_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, perm.rows[0].id, req.auth.userId, reason, expiresAt]
      );

      await db.query(
        `INSERT INTO notifications (user_id, title, body, category, related_entity_id)
         VALUES ($1, $2, $3, 'permission_granted', $4)`,
        [userId, 'You were granted a temporary permission', `${permissionCode}: ${reason}`, rows[0].id]
      );

      await writeAudit({
        userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'PERMISSION_GRANTED',
        entityType: 'user', entityId: userId, result: 'success',
        metadata: { permissionCode, expiresInHours, reason },
      });

      return res.status(201).json({ grant: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

/** DELETE /permissions/delegate/:id — early revocation, granting Principal or Director */
router.delete('/delegate/:id', requireAuth, requireRole('principal', 'director'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM user_permissions WHERE id = $1', [req.params.id]);
    const grant = rows[0];
    if (!grant) throw Errors.notFound();
    if (req.auth.role === 'principal' && grant.granted_by !== req.auth.userId) {
      throw Errors.forbidden('You can only revoke grants you issued yourself.');
    }

    await db.query('UPDATE user_permissions SET revoked_at = now() WHERE id = $1', [req.params.id]);

    await writeAudit({
      userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'PERMISSION_REVOKED',
      entityType: 'user', entityId: grant.user_id, result: 'success',
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

const router = express.Router();

/** GET /devices — Principal/Director see all, others see only their own */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.auth.role === 'principal' || req.auth.role === 'director';
    const { rows } = await db.query(
      isAdmin
        ? `SELECT d.*, u.full_name, u.role FROM devices d JOIN users u ON u.id = d.user_id ORDER BY d.last_seen_at DESC NULLS LAST`
        : `SELECT * FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC NULLS LAST`,
      isAdmin ? [] : [req.auth.userId]
    );
    return res.json({ devices: rows });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /devices/:id — remote revocation. Lost/damaged phone scenario (Section 11). */
router.delete('/:id', requireAuth, requireRole('principal', 'director'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE devices SET status = 'revoked', revoked_at = now(), revoked_by = $2
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.auth.userId]
    );
    if (rows.length === 0) throw Errors.notFound();

    await writeAudit({
      userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'DEVICE_REVOKED',
      entityType: 'device', entityId: req.params.id, result: 'success',
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

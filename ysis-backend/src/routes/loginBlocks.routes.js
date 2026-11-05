const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

const router = express.Router();

// Networks currently blocked. Shows only the IP address.
router.get('/', requireAuth, requireRole('principal', 'director'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ip, blocked_until, created_at FROM ip_blocks
       WHERE blocked_until > now()
       ORDER BY created_at DESC`
    );
    return res.json({ blocks: rows });
  } catch (err) {
    return next(err);
  }
});

// Lifts a network block now. The unblock is written to the audit log.
router.post('/unblock', requireAuth, requireRole('principal', 'director'), async (req, res, next) => {
  try {
    const ip = typeof req.body?.ip === 'string' ? req.body.ip.trim() : '';
    if (!ip) throw Errors.badRequest('VALIDATION_ERROR', 'ip is required.');

    const { rowCount } = await db.query(
      `UPDATE ip_blocks
       SET blocked_until = now(), unblocked_by = $2, unblocked_at = now()
       WHERE ip = $1 AND blocked_until > now()`,
      [ip, req.auth.userId]
    );
    if (rowCount === 0) throw Errors.notFound('That network is not blocked right now.');

    await writeAudit({
      userId: req.auth.userId,
      action: 'IP_UNBLOCK',
      result: 'success',
      metadata: { ip },
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

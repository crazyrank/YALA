const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { Errors } = require('../utils/errors');

const router = express.Router();

/** GET /notifications?status=unread — scoped to caller only */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status;
    const params = [req.auth.userId];
    let where = 'WHERE user_id = $1';
    if (status) { where += ' AND status = $2'; params.push(status); }

    const { rows } = await db.query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`,
      params
    );
    return res.json({ notifications: rows });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /notifications/:id — body { status: 'read' | 'archived' } */
router.patch(
  '/:id',
  requireAuth,
  [body('status').isIn(['read', 'archived'])],
  async (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);

      const { rows } = await db.query(
        `UPDATE notifications SET status = $1,
           read_at = CASE WHEN $1 = 'read' THEN now() ELSE read_at END
         WHERE id = $2 AND user_id = $3 RETURNING *`,
        [req.body.status, req.params.id, req.auth.userId]
      );
      if (rows.length === 0) throw Errors.notFound();
      return res.json({ notification: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

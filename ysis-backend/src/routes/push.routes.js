const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { Errors } = require('../utils/errors');

const router = express.Router();

// Expo push tokens look like ExponentPushToken[...] or ExpoPushToken[...]
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]{5,}\]$/;

/** POST /push/token - register this device's Expo push token */
router.post(
  '/token',
  requireAuth,
  [body('token').isString().custom((value) => EXPO_TOKEN.test(value)).withMessage('Invalid push token.')],
  async (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);

      const token = req.body.token;
      // A token belongs to one device at a time
      await db.query(
        'UPDATE devices SET push_token = NULL WHERE push_token = $1 AND id <> $2',
        [token, req.auth.deviceId]
      );
      await db.query(
        'UPDATE devices SET push_token = $1, last_seen_at = now() WHERE id = $2 AND user_id = $3',
        [token, req.auth.deviceId, req.auth.userId]
      );
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  }
);

/** DELETE /push/token - called on sign-out so this device stops getting alerts */
router.delete('/token', requireAuth, async (req, res, next) => {
  try {
    await db.query(
      'UPDATE devices SET push_token = NULL WHERE id = $1 AND user_id = $2',
      [req.auth.deviceId, req.auth.userId]
    );
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

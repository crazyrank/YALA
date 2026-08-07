const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { hashPassword, verifyPassword, generateTempCredential, sha256 } = require('../utils/hash');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

/**
 * POST /auth/login
 * First login for a NEW device must succeed here while online — this is
 * also where device registration happens (Build Spec Section 4).
 */
router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').isString().notEmpty(),
    body('deviceFingerprint').isString().notEmpty(),
    body('deviceName').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { email, password, deviceFingerprint, deviceName } = req.body;

      const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = rows[0];

      if (!user || !(await verifyPassword(password, user.password_hash))) {
        await writeAudit({ action: 'LOGIN', result: 'failure', metadata: { email } });
        throw Errors.unauthorized('Incorrect email or password.');
      }
      if (user.status !== 'active') {
        await writeAudit({ userId: user.id, action: 'LOGIN', result: 'failure', metadata: { reason: 'inactive_account' } });
        throw Errors.forbidden('This account is not active. Contact your administrator.');
      }

      // Device registration / lookup
      let device;
      const existingDevice = await db.query(
        'SELECT * FROM devices WHERE user_id = $1 AND device_fingerprint = $2',
        [user.id, deviceFingerprint]
      );
      if (existingDevice.rows.length > 0) {
        device = existingDevice.rows[0];
        if (device.status === 'revoked') {
          throw Errors.deviceNotTrusted('This device has been disabled. Contact your Principal.');
        }
        // First-ever login on this device auto-trusts it since credentials
        // were just verified online; subsequent devices follow the same rule.
        if (device.status === 'pending_verification') {
          const updated = await db.query(
            `UPDATE devices SET status = 'trusted', last_seen_at = now() WHERE id = $1 RETURNING *`,
            [device.id]
          );
          device = updated.rows[0];
        } else {
          await db.query('UPDATE devices SET last_seen_at = now() WHERE id = $1', [device.id]);
        }
      } else {
        const created = await db.query(
          `INSERT INTO devices (user_id, device_name, device_fingerprint, status, last_seen_at)
           VALUES ($1, $2, $3, 'trusted', now()) RETURNING *`,
          [user.id, deviceName || null, deviceFingerprint]
        );
        device = created.rows[0];
      }

      const accessToken = signAccessToken({
        userId: user.id, role: user.role, sessionVersion: user.session_version, deviceId: device.id,
      });
      const refreshToken = signRefreshToken({
        userId: user.id, sessionVersion: user.session_version, deviceId: device.id,
      });

      res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
      await writeAudit({ userId: user.id, deviceId: device.id, action: 'LOGIN', result: 'success' });

      return res.json({
        accessToken,
        user: {
          id: user.id,
          fullName: user.full_name,
          role: user.role,
          mustChangePassword: user.must_change_password,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /auth/refresh */
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw Errors.unauthorized();

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (e) {
      throw Errors.unauthorized('Session expired. Please sign in again.');
    }

    const { rows } = await db.query(
      `SELECT u.role, u.session_version, d.status AS device_status
       FROM users u JOIN devices d ON d.id = $2
       WHERE u.id = $1`,
      [payload.userId, payload.deviceId]
    );
    const record = rows[0];
    if (!record || record.session_version !== payload.sessionVersion) {
      throw Errors.unauthorized('Session expired. Please sign in again.');
    }
    if (record.device_status !== 'trusted') throw Errors.deviceNotTrusted();

    const accessToken = signAccessToken({
      userId: payload.userId, role: record.role, sessionVersion: record.session_version, deviceId: payload.deviceId,
    });
    return res.json({ accessToken });
  } catch (err) {
    return next(err);
  }
});

/** POST /auth/logout */
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    res.clearCookie('refreshToken', REFRESH_COOKIE_OPTS);
    await writeAudit({ userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'LOGOUT', result: 'success' });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/reset-password
 * Caller must be Principal (resetting a Head Teacher) or Director
 * (resetting a Principal) — Build Spec Section 9. Director lockout is
 * deliberately NOT handled here; see the build spec's operational runbook note.
 */
router.post(
  '/reset-password',
  requireAuth,
  [body('targetUserId').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { targetUserId } = req.body;

      const { rows } = await db.query('SELECT id, role FROM users WHERE id = $1', [targetUserId]);
      const target = rows[0];
      if (!target) throw Errors.notFound('That account could not be found.');

      const callerRole = req.auth.role;
      const validPair =
        (callerRole === 'principal' && target.role === 'head_teacher') ||
        (callerRole === 'director' && target.role === 'principal');
      if (!validPair) throw Errors.forbidden('You are not able to reset this account.');

      // Invalidate any prior unused token for this user — only one live token at a time.
      await db.query(
        `UPDATE password_reset_tokens SET invalidated_at = now()
         WHERE user_id = $1 AND used_at IS NULL AND invalidated_at IS NULL`,
        [targetUserId]
      );

      const tempCredential = generateTempCredential();
      const tokenHash = sha256(tempCredential);
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes

      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, issued_by, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [targetUserId, tokenHash, req.auth.userId, expiresAt]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'PASSWORD_RESET_ISSUED',
        entityType: 'user',
        entityId: targetUserId,
        result: 'success',
      });

      // Shown ONCE — the Principal relays this verbally, per the design.
      return res.json({ tempCredential, expiresAt });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /auth/complete-reset */
router.post(
  '/complete-reset',
  [
    body('email').isEmail(),
    body('tempCredential').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 8 }),
    body('deviceFingerprint').isString().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { email, tempCredential, newPassword, deviceFingerprint } = req.body;

      const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      const user = rows[0];
      if (!user) throw Errors.unauthorized('Invalid reset details.');

      const tokenHash = sha256(tempCredential);
      const { rows: tokenRows } = await db.query(
        `SELECT * FROM password_reset_tokens
         WHERE user_id = $1 AND token_hash = $2
           AND used_at IS NULL AND invalidated_at IS NULL AND expires_at > now()`,
        [user.id, tokenHash]
      );
      const resetToken = tokenRows[0];
      if (!resetToken) throw Errors.unauthorized('This reset code is invalid or has expired.');

      const device = await db.query(
        'SELECT id FROM devices WHERE user_id = $1 AND device_fingerprint = $2',
        [user.id, deviceFingerprint]
      );
      const deviceId = device.rows[0]?.id || null;

      const newHash = await hashPassword(newPassword);
      await db.query(
        `UPDATE users SET password_hash = $2, must_change_password = FALSE,
         session_version = session_version + 1, updated_at = now() WHERE id = $1`,
        [user.id, newHash]
      );
      await db.query(
        `UPDATE password_reset_tokens SET used_at = now(), used_from_device_id = $2 WHERE id = $1`,
        [resetToken.id, deviceId]
      );

      await writeAudit({
        userId: user.id,
        deviceId,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'user',
        entityId: user.id,
        result: 'success',
      });

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

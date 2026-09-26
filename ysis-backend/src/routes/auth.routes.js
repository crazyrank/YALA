const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { hashPassword, verifyPassword, generateTempCredential, sha256 } = require('../utils/hash');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const config = require('../config');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
  keyGenerator: (req) => {
    const id = req.body && (req.body.email || req.body.username);
    return id ? String(id).toLowerCase() : ipKeyGenerator(req.ip);
  },
});

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
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

function issueTokens(res, { userId, role, sessionVersion, deviceId }) {
  const accessToken = signAccessToken({ userId, role, sessionVersion, deviceId });
  const refreshToken = signRefreshToken({ userId, sessionVersion, deviceId });
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
  return { accessToken, refreshToken };
}

async function storeRefreshHash(deviceId, refreshToken) {
  const hash = sha256(refreshToken);
  await db.query(
    'UPDATE devices SET refresh_token_hash = $2, last_seen_at = now() WHERE id = $1',
    [deviceId, hash]
  );
}

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().notEmpty(),
    body('deviceFingerprint').isString().isLength({ min: 8, max: 128 }),
    body('deviceName').optional().isString().isLength({ max: 120 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { email, password, deviceFingerprint, deviceName } = req.body;

      const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = rows[0];

      // Constant-time style: always verify against a dummy hash if no user
      const hashToCheck = user ? user.password_hash : '$2a$12$invalidhashinvalidhashinvalidhu';
      const passwordOk = await verifyPassword(password, hashToCheck);

      if (!user || !passwordOk) {
        if (user) {
          const nextCount = (user.failed_login_count || 0) + 1;
          const updates = { failed_login_count: nextCount };
          if (nextCount >= config.maxFailedLogins) {
            updates.locked_until = new Date(Date.now() + config.lockoutMinutes * 60 * 1000);
          }
          await db.query(
            `UPDATE users SET failed_login_count = $2,
               locked_until = COALESCE($3, locked_until), updated_at = now()
             WHERE id = $1`,
            [user.id, nextCount, updates.locked_until || null]
          );
        }
        // Do not store raw email in audit on failure — store a short hash only
        await writeAudit({
          action: 'LOGIN',
          result: 'failure',
          metadata: { emailHash: sha256(email).slice(0, 16) },
        });
        throw Errors.unauthorized('Incorrect email or password.');
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        throw Errors.accountLocked();
      }

      if (user.status !== 'active') {
        await writeAudit({
          userId: user.id,
          action: 'LOGIN',
          result: 'failure',
          metadata: { reason: 'inactive_account' },
        });
        throw Errors.forbidden('This account is not active. Contact your administrator.');
      }

      // Clear lockout counters on successful auth
      if (user.failed_login_count > 0 || user.locked_until) {
        await db.query(
          `UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = now() WHERE id = $1`,
          [user.id]
        );
      }

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
        if (device.status === 'pending_verification') {
          // Still pending — do not auto-promote. User must wait for admin approval.
          throw Errors.deviceNotTrusted(
            'This device is waiting for approval by your Principal. Try again after it is approved.'
          );
        }
        await db.query('UPDATE devices SET last_seen_at = now() WHERE id = $1', [device.id]);
      } else {
        // New fingerprint. Auto-trust only if this is the user's first device ever.
        // Subsequent devices stay pending_verification until Principal/Director approves.
        const { rows: countRows } = await db.query(
          'SELECT COUNT(*)::int AS c FROM devices WHERE user_id = $1 AND status != $2',
          [user.id, 'revoked']
        );
        const isFirstDevice = (countRows[0]?.c || 0) === 0;
        const initialStatus = isFirstDevice ? 'trusted' : 'pending_verification';

        const created = await db.query(
          `INSERT INTO devices (user_id, device_name, device_fingerprint, status, last_seen_at)
           VALUES ($1, $2, $3, $4, now()) RETURNING *`,
          [user.id, deviceName || null, deviceFingerprint, initialStatus]
        );
        device = created.rows[0];

        if (initialStatus === 'pending_verification') {
          await writeAudit({
            userId: user.id,
            deviceId: device.id,
            action: 'DEVICE_REGISTERED_PENDING',
            result: 'success',
            metadata: { deviceName: deviceName || null },
          });
          throw Errors.deviceNotTrusted(
            'This is a new device. It has been registered and is waiting for your Principal to approve it.'
          );
        }
      }

      const { accessToken, refreshToken } = issueTokens(res, {
        userId: user.id,
        role: user.role,
        sessionVersion: user.session_version,
        deviceId: device.id,
      });
      await storeRefreshHash(device.id, refreshToken);

      await writeAudit({
        userId: user.id,
        deviceId: device.id,
        action: 'LOGIN',
        result: 'success',
      });

      return res.json({
        accessToken,
        // Also return refreshToken in body for React Native clients that
        // cannot reliably manage httpOnly cookies across origins.
        refreshToken,
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

/**
 * Refresh accepts either the httpOnly cookie OR a body.refreshToken.
 * Mobile clients prefer the body form for reliability.
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) throw Errors.unauthorized();

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (e) {
      throw Errors.unauthorized('Session expired. Please sign in again.');
    }

    const { rows } = await db.query(
      `SELECT u.role, u.session_version, u.status, d.status AS device_status, d.refresh_token_hash
       FROM users u
       JOIN devices d ON d.id = $2 AND d.user_id = u.id
       WHERE u.id = $1`,
      [payload.userId, payload.deviceId]
    );
    const record = rows[0];
    if (!record || record.status !== 'active') {
      throw Errors.unauthorized('Session expired. Please sign in again.');
    }
    if (record.session_version !== payload.sessionVersion) {
      throw Errors.unauthorized('Session expired. Please sign in again.');
    }
    if (record.device_status !== 'trusted') throw Errors.deviceNotTrusted();

    // Bound refresh token to the one we stored at login/refresh (logout clears it)
    const presentedHash = sha256(token);
    if (!record.refresh_token_hash || record.refresh_token_hash !== presentedHash) {
      throw Errors.unauthorized('Session expired. Please sign in again.');
    }

    const { accessToken, refreshToken } = issueTokens(res, {
      userId: payload.userId,
      role: record.role,
      sessionVersion: record.session_version,
      deviceId: payload.deviceId,
    });
    await storeRefreshHash(payload.deviceId, refreshToken);

    return res.json({ accessToken, refreshToken });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    // Invalidate this device's refresh token without killing other devices
    await db.query(
      'UPDATE devices SET refresh_token_hash = NULL WHERE id = $1',
      [req.auth.deviceId]
    );
    res.clearCookie('refreshToken', REFRESH_COOKIE_OPTS);
    await writeAudit({
      userId: req.auth.userId,
      deviceId: req.auth.deviceId,
      action: 'LOGOUT',
      result: 'success',
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/**
 * Authenticated password change. Required when must_change_password is set,
 * and available any time for voluntary changes. Increments session_version
 * so other sessions are forced to re-authenticate (architecture: password
 * change is a security boundary).
 */
router.post(
  '/change-password',
  requireAuth,
  [
    body('oldPassword').isString().notEmpty(),
    body('newPassword').isString().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { oldPassword, newPassword } = req.body;

      const strength = validatePasswordStrength(newPassword);
      if (!strength.ok) {
        throw Errors.badRequest('WEAK_PASSWORD', strength.message);
      }

      const { rows } = await db.query(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [req.auth.userId]
      );
      const user = rows[0];
      if (!user) throw Errors.unauthorized();

      const ok = await verifyPassword(oldPassword, user.password_hash);
      if (!ok) {
        throw Errors.unauthorized('Current password is incorrect.');
      }

      if (oldPassword === newPassword) {
        throw Errors.badRequest('WEAK_PASSWORD', 'New password must be different from the current one.');
      }

      const newHash = await hashPassword(newPassword);
      await db.query(
        `UPDATE users SET password_hash = $2, must_change_password = FALSE,
           session_version = session_version + 1, failed_login_count = 0,
           locked_until = NULL, updated_at = now()
         WHERE id = $1`,
        [user.id, newHash]
      );

      // Invalidate all refresh tokens for this user (password change boundary)
      await db.query(
        'UPDATE devices SET refresh_token_hash = NULL WHERE user_id = $1',
        [user.id]
      );
      res.clearCookie('refreshToken', REFRESH_COOKIE_OPTS);

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'PASSWORD_CHANGED',
        entityType: 'user',
        entityId: user.id,
        result: 'success',
      });

      return res.json({ ok: true, mustReLogin: true });
    } catch (err) {
      return next(err);
    }
  }
);

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

      await db.query(
        `UPDATE password_reset_tokens SET invalidated_at = now()
         WHERE user_id = $1 AND used_at IS NULL AND invalidated_at IS NULL`,
        [targetUserId]
      );

      const tempCredential = generateTempCredential();
      const tokenHash = sha256(tempCredential);
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

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

      return res.json({ tempCredential, expiresAt });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/complete-reset',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('tempCredential').isString().notEmpty(),
    body('newPassword').isString().notEmpty(),
    body('deviceFingerprint').isString().isLength({ min: 8, max: 128 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { email, tempCredential, newPassword, deviceFingerprint } = req.body;

      const strength = validatePasswordStrength(newPassword);
      if (!strength.ok) {
        throw Errors.badRequest('WEAK_PASSWORD', strength.message);
      }

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
           session_version = session_version + 1, failed_login_count = 0,
           locked_until = NULL, updated_at = now() WHERE id = $1`,
        [user.id, newHash]
      );
      await db.query(
        `UPDATE password_reset_tokens SET used_at = now(), used_from_device_id = $2 WHERE id = $1`,
        [resetToken.id, deviceId]
      );
      // Invalidate all device refresh tokens after password reset
      await db.query(
        'UPDATE devices SET refresh_token_hash = NULL WHERE user_id = $1',
        [user.id]
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

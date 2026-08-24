const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { hashPassword, generateTempCredential } = require('../utils/hash');
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

// Caller's role determines the ONLY role they're allowed to create — this
// is inferred, never taken from the request body, so there's no field to
// tamper with to escalate privilege (Build Spec Section 3 hierarchy).
const CREATABLE_ROLE_BY_CALLER = {
  director: 'principal',
  principal: 'head_teacher',
};

/**
 * POST /users
 * Director creates a Principal, or Principal creates a Head Teacher.
 * Mirrors the /auth/reset-password flow: generates a temp credential,
 * returns it ONCE in the response body, forces a password change on
 * first login. No route exists for creating a Director (Build Spec
 * Section 3 — Director is DB-seeded only, no in-app recovery/creation).
 */
router.post(
  '/',
  requireAuth,
  requireRole('director', 'principal'),
  [
    body('fullName').isString().trim().notEmpty(),
    body('email').isEmail(),
    body('phone').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { fullName, email, phone } = req.body;

      const targetRole = CREATABLE_ROLE_BY_CALLER[req.auth.role];
      if (!targetRole) throw Errors.forbidden('You are not able to create accounts.');

      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        throw Errors.conflict('EMAIL_IN_USE', 'An account with this email already exists.');
      }

      const tempCredential = generateTempCredential();
      const passwordHash = await hashPassword(tempCredential);

      const { rows } = await db.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, must_change_password, created_by)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)
         RETURNING id, full_name, email, phone, role, status, created_at`,
        [fullName, email, phone || null, passwordHash, targetRole, req.auth.userId]
      );
      const created = rows[0];

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'ACCOUNT_CREATED',
        entityType: 'user',
        entityId: created.id,
        result: 'success',
        metadata: { role: targetRole },
      });

      // Shown ONCE — the caller relays this verbally to the new user,
      // same discipline as the reset-password temp credential.
      return res.status(201).json({
        user: {
          id: created.id,
          fullName: created.full_name,
          email: created.email,
          phone: created.phone,
          role: created.role,
          status: created.status,
          createdAt: created.created_at,
        },
        tempCredential,
      });
    } catch (err) {
      // Belt-and-suspenders: a race between the SELECT check and INSERT
      // still hits the DB's UNIQUE constraint on email (citext).
      if (err.code === '23505') {
        return next(Errors.conflict('EMAIL_IN_USE', 'An account with this email already exists.'));
      }
      return next(err);
    }
  }
);

/**
 * GET /users
 * Returns the staff the caller manages: Director sees the Principals they
 * created, Principal sees the Head Teachers they created. Scoped by
 * created_by so one Principal never sees another Principal's staff.
 */
router.get('/', requireAuth, requireRole('director', 'principal'), async (req, res, next) => {
  try {
    const targetRole = CREATABLE_ROLE_BY_CALLER[req.auth.role];
    if (!targetRole) throw Errors.forbidden('You are not able to view staff accounts.');

    const { rows } = await db.query(
      `SELECT id, full_name, email, phone, role, status, created_at
       FROM users WHERE role = $1 AND created_by = $2
       ORDER BY created_at DESC`,
      [targetRole, req.auth.userId]
    );

    return res.json({
      users: rows.map((u) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.created_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /users/:id/status
 * Disable ('suspended') or re-enable ('active') a staff account the caller
 * created — same hierarchy + ownership rule as everywhere else here.
 * Suspending also bumps session_version, which immediately invalidates
 * any access/refresh token already issued to that account (requireAuth
 * checks session_version against the DB on every request).
 */
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('director', 'principal'),
  [body('status').isIn(['active', 'suspended'])],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { id } = req.params;
      const { status } = req.body;

      const { rows } = await db.query('SELECT id, role, created_by FROM users WHERE id = $1', [id]);
      const target = rows[0];
      if (!target) throw Errors.notFound('That account could not be found.');

      const targetRole = CREATABLE_ROLE_BY_CALLER[req.auth.role];
      const ownsTarget = target.role === targetRole && target.created_by === req.auth.userId;
      if (!ownsTarget) throw Errors.forbidden('You are not able to manage this account.');

      const updated = await db.query(
        `UPDATE users SET status = $2, session_version = session_version + 1, updated_at = now()
         WHERE id = $1
         RETURNING id, full_name, email, phone, role, status, created_at`,
        [id, status]
      );
      const user = updated.rows[0];

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: status === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_REACTIVATED',
        entityType: 'user',
        entityId: id,
        result: 'success',
      });

      return res.json({
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

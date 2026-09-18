const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { hashPassword, generateTempCredential } = require('../utils/hash');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { userHasPermission } = require('../services/permissionService');
const { CLASS_ORDER } = require('../utils/classProgression');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

const CREATABLE_ROLE_BY_CALLER = {
  director: 'principal',
  principal: 'head_teacher',
};

/**
 * Shared gate for the class-assignment endpoints below. Director can
 * manage any head_teacher's assignments. Principal can only manage
 * assignments for head_teachers they personally created (same ownership
 * rule as PATCH /:id/status). Anyone else needs the delegated
 * MANAGE_CLASS_ASSIGNMENTS permission (via user_permissions) and, since
 * this system has no notion of "delegate owns HT X", is treated as
 * unscoped like director once granted.
 */
async function assertCanManageClassAssignments(req, target) {
  if (req.auth.role !== 'director' && req.auth.role !== 'principal') {
    const allowed = await userHasPermission({
      userId: req.auth.userId,
      role: req.auth.role,
      permissionCode: 'MANAGE_CLASS_ASSIGNMENTS',
      atTime: new Date(),
    });
    if (!allowed) {
      throw Errors.forbidden('You do not have permission to manage class assignments.');
    }
    return;
  }

  if (req.auth.role === 'principal' && target.created_by !== req.auth.userId) {
    throw Errors.forbidden('You are not able to manage this account.');
  }
}

async function loadHeadTeacherTarget(userId) {
  const { rows } = await db.query('SELECT id, role, created_by FROM users WHERE id = $1', [userId]);
  const target = rows[0];
  if (!target) throw Errors.notFound('That account could not be found.');
  if (target.role !== 'head_teacher') {
    throw Errors.badRequest('INVALID_TARGET_ROLE', 'Only Head Teacher accounts have class assignments.');
  }
  return target;
}

/**
 * POST /users
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
      const directoryTitle = targetRole === 'principal' ? 'Principal' : 'Head Teacher';

      const created = await db.withTransaction(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO users (full_name, email, phone, password_hash, role, must_change_password, created_by)
           VALUES ($1, $2, $3, $4, $5, TRUE, $6)
           RETURNING id, full_name, email, phone, role, status, created_at`,
          [fullName, email, phone || null, passwordHash, targetRole, req.auth.userId]
        );
        const user = rows[0];

        await client.query(
          `INSERT INTO staff_directory (section, full_name, title, linked_user_id, created_by)
           VALUES ('management', $1, $2, $3, $4)`,
          [user.full_name, directoryTitle, user.id, req.auth.userId]
        );

        return user;
      });

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'ACCOUNT_CREATED',
        entityType: 'user',
        entityId: created.id,
        result: 'success',
        metadata: { role: targetRole },
      });

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
      if (err.code === '23505') {
        return next(Errors.conflict('EMAIL_IN_USE', 'An account with this email already exists.'));
      }
      return next(err);
    }
  }
);

/**
 * GET /users
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
 */
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('director', 'principal'),
  [
    param('id').isUUID(),
    body('status').isIn(['active', 'suspended']),
  ],
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

/**
 * POST /users/:id/class-assignments
 */
router.post(
  '/:id/class-assignments',
  requireAuth,
  [
    param('id').isUUID(),
    body('division').isIn(['primary', 'secondary']),
    body('classLevel').isIn(CLASS_ORDER),
    body('arm').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const target = await loadHeadTeacherTarget(req.params.id);
      await assertCanManageClassAssignments(req, target);

      const { division, classLevel, arm } = req.body;

      const inserted = await db.query(
        `INSERT INTO head_teacher_class_assignments (user_id, division, class_level, arm, assigned_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, division, class_level, arm, assigned_at`,
        [target.id, division, classLevel, arm || null, req.auth.userId]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'CLASS_ASSIGNMENT_CREATED',
        entityType: 'user',
        entityId: target.id,
        result: 'success',
        metadata: { division, classLevel, arm: arm || null },
      });

      return res.status(201).json({ assignment: inserted.rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /users/:id/class-assignments
 */
router.get(
  '/:id/class-assignments',
  requireAuth,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const target = await loadHeadTeacherTarget(req.params.id);
      await assertCanManageClassAssignments(req, target);

      const { rows } = await db.query(
        `SELECT id, division, class_level, arm, assigned_at
         FROM head_teacher_class_assignments
         WHERE user_id = $1
         ORDER BY assigned_at ASC`,
        [target.id]
      );

      return res.json({ assignments: rows });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /users/:id/class-assignments/:assignmentId
 */
router.delete(
  '/:id/class-assignments/:assignmentId',
  requireAuth,
  [
    param('id').isUUID(),
    param('assignmentId').isUUID(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const target = await loadHeadTeacherTarget(req.params.id);
      await assertCanManageClassAssignments(req, target);

      const deleted = await db.query(
        `DELETE FROM head_teacher_class_assignments
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [req.params.assignmentId, target.id]
      );

      if (deleted.rows.length === 0) {
        throw Errors.notFound('That class assignment could not be found.');
      }

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'CLASS_ASSIGNMENT_REMOVED',
        entityType: 'user',
        entityId: target.id,
        result: 'success',
        metadata: { assignmentId: req.params.assignmentId },
      });

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

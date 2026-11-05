const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { getScopeForUser } = require('../services/studentScopeService');
const { canViewStaff } = require('../utils/staffProfileRules');
const { applyStaffProfileUpdate } = require('../services/staffProfileService');

const router = express.Router();

const VIEW_ROLES = ['principal', 'director', 'head_teacher'];

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

// Divisions a Head Teacher can reach. Principal and Director are unscoped, so this returns [].
async function divisionsFor(auth) {
  if (auth.role !== 'head_teacher') return [];
  const scope = await getScopeForUser(auth);
  return [...new Set((scope || []).map((s) => s.division))];
}

/**
 * GET /staff-profiles
 * The list of staff the caller may open. Matches canViewStaff in staffProfileRules.js.
 */
router.get('/', requireAuth, requireRole(...VIEW_ROLES), async (req, res, next) => {
  try {
    const { role, userId } = req.auth;
    const params = [userId];
    let scopeClause;

    if (role === 'principal') {
      scopeClause = `(u.role = 'class_teacher' OR (u.role = 'head_teacher' AND u.created_by = $1))`;
    } else if (role === 'director') {
      scopeClause = `(u.role = 'class_teacher'
                      OR (u.role IN ('principal', 'head_teacher') AND u.created_by = $1))`;
    } else {
      const divisions = await divisionsFor(req.auth);
      params.push(divisions);
      scopeClause = `(u.role = 'class_teacher' AND cta.division = ANY($2::text[]))`;
    }

    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.role, u.status, cta.division, cta.class_level, cta.arm
         FROM users u
         LEFT JOIN class_teacher_assignments cta ON cta.user_id = u.id
        WHERE u.id <> $1
          AND u.status <> 'inactive'
          AND ${scopeClause}
        ORDER BY u.full_name ASC`,
      params
    );

    return res.json({
      staff: rows.map((u) => ({
        id: u.id,
        fullName: u.full_name,
        role: u.role,
        status: u.status,
        division: u.division,
        classLevel: u.class_level,
        arm: u.arm,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /staff-profiles/:id
 * One staff profile. Contact details and assignments only. Never passwords, tokens or devices.
 */
router.get(
  '/:id',
  requireAuth,
  requireRole(...VIEW_ROLES),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const { rows } = await db.query(
        `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.status, u.created_by, u.created_at, u.updated_at, u.profile_version,
                cta.division, cta.class_level, cta.arm
           FROM users u
           LEFT JOIN class_teacher_assignments cta ON cta.user_id = u.id
          WHERE u.id = $1`,
        [req.params.id]
      );
      const subject = rows[0];
      if (!subject) throw Errors.notFound('That staff profile could not be found.');

      const divisions = await divisionsFor(req.auth);
      if (!canViewStaff({
        viewerRole: req.auth.role,
        viewerId: req.auth.userId,
        viewerDivisions: divisions,
        subject,
      })) {
        throw Errors.forbidden('You are not able to open this profile.');
      }

      let assignments = [];
      if (subject.role === 'class_teacher' && subject.division) {
        assignments = [{
          division: subject.division,
          classLevel: subject.class_level,
          arm: subject.arm,
        }];
      } else if (subject.role === 'head_teacher') {
        const { rows: scopeRows } = await db.query(
          `SELECT division, class_level, arm
             FROM head_teacher_class_assignments
            WHERE user_id = $1
            ORDER BY division, class_level`,
          [subject.id]
        );
        assignments = scopeRows.map((s) => ({
          division: s.division,
          classLevel: s.class_level,
          arm: s.arm,
        }));
      }

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STAFF_PROFILE_VIEWED',
        entityType: 'user',
        entityId: subject.id,
        result: 'success',
      });

      return res.json({
        profile: {
          id: subject.id,
          fullName: subject.full_name,
          email: subject.email,
          phone: subject.phone,
          role: subject.role,
          status: subject.status,
          createdAt: subject.created_at,
          updatedAt: subject.updated_at,
          version: Number(subject.profile_version || 1),
          assignments,
          canEdit: req.auth.role !== 'head_teacher',
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /staff-profiles/:id   body { fullName, email, phone }
 * Principal and Director only. Head Teachers cannot edit profiles.
 * Role, status and class assignments are not changed here.
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('principal', 'director'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await applyStaffProfileUpdate({
        subjectId: req.params.id,
        payload: req.body,
        auth: req.auth,
      });
      if (!result.ok) {
        if (result.conflict) throw Errors.conflict(result.code, result.message);
        if (result.code === 'NOT_FOUND') throw Errors.notFound(result.message);
        if (result.code === 'FORBIDDEN') throw Errors.forbidden(result.message);
        throw Errors.badRequest(result.code, result.message);
      }
      return res.json({ ok: true, changed: result.changed, version: result.profileVersion });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

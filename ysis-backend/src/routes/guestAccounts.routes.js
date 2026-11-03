const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { hashPassword, generateTempCredential } = require('../utils/hash');
const { Errors } = require('../utils/errors');

const router = express.Router();
const ADMIN_ROLES = ['director', 'principal'];

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
}

async function loadOwnedGuest(actor, id, client = db) {
  const { rows } = await client.query(
    `SELECT id, full_name, email, phone, role, status, created_by,
            guest_expires_at, guest_reason, created_at
       FROM users WHERE id = $1 AND role = 'guest'`, [id]);
  const target = rows[0];
  if (!target) throw Errors.notFound('Guest account not found.');
  if (actor.role !== 'director' && target.created_by !== actor.userId) throw Errors.forbidden('You can only manage Guest accounts you created.');
  return target;
}

// Creation is approval: only a Director or Principal can provision a Guest.
router.post('/', requireAuth, requireRole(...ADMIN_ROLES), [
  body('fullName').isString().trim().isLength({ min: 2, max: 160 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).isString().isLength({ max: 40 }),
  body('reason').isString().trim().isLength({ min: 8, max: 1000 }),
  body('expiresAt').isISO8601(),
  body('studentIds').isArray({ min: 1, max: 100 }),
  body('studentIds.*').isUUID(),
], async (req, res, next) => {
  try {
    checkValidation(req);
    const { fullName, email, phone, reason, expiresAt, studentIds } = req.body;
    const expiry = new Date(expiresAt);
    if (!Number.isFinite(expiry.getTime()) || expiry <= new Date() || expiry > new Date(Date.now() + 366 * 86400000)) {
      throw Errors.badRequest('INVALID_EXPIRY', 'Guest access must expire within the next 366 days.');
    }
    const uniqueStudentIds = [...new Set(studentIds)];
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) throw Errors.conflict('EMAIL_IN_USE', 'An account with this email already exists.');
    const found = await db.query('SELECT id FROM students WHERE id = ANY($1::uuid[])', [uniqueStudentIds]);
    if (found.rows.length !== uniqueStudentIds.length) throw Errors.badRequest('INVALID_STUDENT', 'One or more selected students do not exist.');

    const tempCredential = generateTempCredential();
    const passwordHash = await hashPassword(tempCredential);
    const guest = await db.withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, must_change_password, created_by, guest_expires_at, guest_reason)
         VALUES ($1, $2, $3, $4, 'guest', TRUE, $5, $6, $7)
         RETURNING id, full_name, email, phone, role, status, created_at, guest_expires_at`,
        [fullName.trim(), email, phone || null, passwordHash, req.auth.userId, expiry, reason.trim()]);
      const row = inserted.rows[0];
      for (const studentId of uniqueStudentIds) {
        await client.query(
          `INSERT INTO guest_student_access (guest_user_id, student_id, granted_by) VALUES ($1, $2, $3)`,
          [row.id, studentId, req.auth.userId]);
      }
      return row;
    });
    await writeAudit({ userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'GUEST_ACCOUNT_CREATED', entityType: 'user', entityId: guest.id, result: 'success', metadata: { expiresAt: guest.guest_expires_at, reason: reason.trim(), studentCount: uniqueStudentIds.length } });
    return res.status(201).json({ user: { id: guest.id, fullName: guest.full_name, email: guest.email, phone: guest.phone, role: guest.role, status: guest.status, createdAt: guest.created_at, expiresAt: guest.guest_expires_at, reason: reason.trim(), studentCount: uniqueStudentIds.length }, tempCredential });
  } catch (err) {
    if (err.code === '23505') return next(Errors.conflict('EMAIL_IN_USE', 'An account with this email already exists.'));
    return next(err);
  }
});

router.get('/', requireAuth, requireRole(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, u.guest_expires_at, u.guest_reason,
              COUNT(gsa.student_id)::int AS student_count
         FROM users u LEFT JOIN guest_student_access gsa ON gsa.guest_user_id = u.id
        WHERE u.role = 'guest' AND ($2::boolean = TRUE OR u.created_by = $1)
        GROUP BY u.id ORDER BY u.created_at DESC`, [req.auth.userId, req.auth.role === 'director']);
    return res.json({ guests: rows.map((r) => ({ id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, status: r.status, createdAt: r.created_at, expiresAt: r.guest_expires_at, reason: r.guest_reason, studentCount: r.student_count, expired: new Date(r.guest_expires_at) <= new Date() })) });
  } catch (err) { return next(err); }
});


router.post('/student-views/:studentId', requireAuth, requireRole('guest'), [param('studentId').isUUID()], async (req, res, next) => {
  try {
    checkValidation(req);
    const { rows } = await db.query(
      'SELECT 1 FROM guest_student_access WHERE guest_user_id = $1 AND student_id = $2',
      [req.auth.userId, req.params.studentId]
    );
    if (!rows.length) throw Errors.forbidden('This student is not assigned to your Guest account.');
    await writeAudit({ userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'GUEST_STUDENT_VIEWED', entityType: 'student', entityId: req.params.studentId, result: 'success' });
    return res.status(204).send();
  } catch (err) { return next(err); }
});

router.patch('/:id/status', requireAuth, requireRole(...ADMIN_ROLES), [param('id').isUUID(), body('status').isIn(['active', 'suspended'])], async (req, res, next) => {
  try {
    checkValidation(req);
    const target = await loadOwnedGuest(req.auth, req.params.id);
    if (target.status === 'inactive') throw Errors.badRequest('ACCOUNT_INACTIVE', 'This Guest account is inactive and cannot be reactivated.');
    const { rows } = await db.query(
      `UPDATE users SET status = $2, session_version = session_version + 1, updated_at = now()
        WHERE id = $1 RETURNING id, full_name, status`, [target.id, req.body.status]);
    await writeAudit({ userId: req.auth.userId, deviceId: req.auth.deviceId, action: req.body.status === 'suspended' ? 'GUEST_ACCOUNT_SUSPENDED' : 'GUEST_ACCOUNT_REACTIVATED', entityType: 'user', entityId: target.id, result: 'success' });
    return res.json({ user: { id: rows[0].id, fullName: rows[0].full_name, status: rows[0].status } });
  } catch (err) { return next(err); }
});

router.patch('/:id/renew', requireAuth, requireRole(...ADMIN_ROLES), [param('id').isUUID(), body('expiresAt').isISO8601(), body('reason').isString().trim().isLength({ min: 8, max: 1000 })], async (req, res, next) => {
  try {
    checkValidation(req);
    const target = await loadOwnedGuest(req.auth, req.params.id);
    const expiry = new Date(req.body.expiresAt);
    if (!Number.isFinite(expiry.getTime()) || expiry <= new Date() || expiry > new Date(Date.now() + 366 * 86400000)) throw Errors.badRequest('INVALID_EXPIRY', 'Choose a future expiry date within 366 days.');
    if (target.status === 'inactive') throw Errors.badRequest('ACCOUNT_INACTIVE', 'This Guest account is inactive and cannot be renewed.');
    const { rows } = await db.query(`UPDATE users SET guest_expires_at = $2, guest_reason = $3, session_version = session_version + 1, updated_at = now() WHERE id = $1 RETURNING id, guest_expires_at`, [target.id, expiry, req.body.reason.trim()]);
    await writeAudit({ userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'GUEST_ACCOUNT_RENEWED', entityType: 'user', entityId: target.id, result: 'success', metadata: { expiresAt: rows[0].guest_expires_at, reason: req.body.reason.trim() } });
    return res.json({ user: { id: rows[0].id, expiresAt: rows[0].guest_expires_at } });
  } catch (err) { return next(err); }
});

module.exports = router;

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { getScopeForUser } = require('../services/studentScopeService');

const router = express.Router();

// Admins only. Association members are not users and cannot edit anything.
const ADMIN_ROLES = ['principal', 'director', 'head_teacher'];
const STATUSES = ['contactable', 'opted_out', 'deceased'];
const DIVISIONS = ['primary', 'secondary'];
const MAX_TEXT = 500;

// Form field name -> database column.
const FIELDS = {
  fullName: 'full_name',
  division: 'division',
  graduationSession: 'graduation_session',
  lastClassLevel: 'last_class_level',
  phone: 'phone',
  email: 'email',
  address: 'address',
  notes: 'notes',
  contactStatus: 'contact_status',
};

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

// Trims text and validates each field that was sent. Blank optional text becomes null.
function pickFields(raw) {
  const out = {};
  for (const key of Object.keys(FIELDS)) {
    if (raw[key] === undefined) continue;
    const value = raw[key];
    if (value !== null && typeof value !== 'string') {
      throw Errors.badRequest('VALIDATION_ERROR', `${key} must be text.`);
    }
    const trimmed = value === null ? '' : value.trim();
    if (trimmed.length > MAX_TEXT) {
      throw Errors.badRequest('TOO_LONG', `Keep ${key} under ${MAX_TEXT} characters.`);
    }
    out[key] = trimmed || null;
  }
  if (out.fullName !== undefined && (!out.fullName || out.fullName.length < 2)) {
    throw Errors.badRequest('VALIDATION_ERROR', 'Enter the full name.');
  }
  if (out.division !== undefined && !DIVISIONS.includes(out.division)) {
    throw Errors.badRequest('VALIDATION_ERROR', 'Choose primary or secondary.');
  }
  if (out.contactStatus !== undefined && !STATUSES.includes(out.contactStatus)) {
    throw Errors.badRequest('VALIDATION_ERROR', 'Choose a valid contact status.');
  }
  return out;
}

// null means unrestricted (Principal, Director). A Head Teacher gets their own divisions only.
async function divisionScope(auth) {
  if (auth.role !== 'head_teacher') return null;
  const scope = await getScopeForUser(auth);
  return [...new Set((scope || []).map((item) => item.division))];
}

function inScope(scope, division) {
  return scope === null || (Boolean(division) && scope.includes(division));
}

const RECORD_COLUMNS = `id, full_name, division, graduation_session, last_class_level,
  phone, email, address, notes, contact_status, updated_at`;

function serialize(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    division: row.division,
    graduationSession: row.graduation_session,
    lastClassLevel: row.last_class_level,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    contactStatus: row.contact_status,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /alumni?q=name&status=contactable|opted_out|deceased|all
 * Default shows only contactable alumni. Head Teachers see only their own division.
 */
router.get(
  '/',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  [
    query('status').optional().isIn([...STATUSES, 'all']),
    query('q').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const status = req.query.status || 'contactable';
      const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const scope = await divisionScope(req.auth);

      const params = [];
      const where = [];
      if (status !== 'all') {
        params.push(status);
        where.push(`contact_status = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        where.push(`full_name ILIKE $${params.length}`);
      }
      if (scope !== null) {
        params.push(scope);
        where.push(`division = ANY($${params.length}::text[])`);
      }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const { rows } = await db.query(
        `SELECT ${RECORD_COLUMNS} FROM alumni_records ${clause} ORDER BY full_name ASC`,
        params
      );
      return res.json({ records: rows.map(serialize) });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  [body('fullName').exists()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const v = pickFields(req.body);
      if (!v.fullName) throw Errors.badRequest('VALIDATION_ERROR', 'Enter the full name.');
      if (!v.division) throw Errors.badRequest('VALIDATION_ERROR', 'Choose primary or secondary.');

      const scope = await divisionScope(req.auth);
      if (!inScope(scope, v.division)) {
        throw Errors.forbidden('You can add alumni only in your own division.');
      }

      const { rows } = await db.query(
        `INSERT INTO alumni_records
           (full_name, division, graduation_session, last_class_level, phone, email,
            address, notes, contact_status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${RECORD_COLUMNS}`,
        [
          v.fullName,
          v.division,
          v.graduationSession ?? null,
          v.lastClassLevel ?? null,
          v.phone ?? null,
          v.email ?? null,
          v.address ?? null,
          v.notes ?? null,
          v.contactStatus || 'contactable',
          req.auth.userId,
        ]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'ALUMNI_RECORD_CREATED',
        entityType: 'alumni_record',
        entityId: rows[0].id,
        result: 'success',
        metadata: { division: rows[0].division },
      });

      return res.status(201).json({ record: serialize(rows[0]) });
    } catch (err) {
      return next(err);
    }
  }
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const v = pickFields(req.body);
      const keys = Object.keys(v);
      if (keys.length === 0) {
        throw Errors.badRequest('VALIDATION_ERROR', 'Nothing to change.');
      }

      const { rows: found } = await db.query(
        'SELECT id, division FROM alumni_records WHERE id = $1',
        [req.params.id]
      );
      if (!found[0]) throw Errors.notFound('That alumni record could not be found.');

      // Must be allowed to act on the record as it is now, and on the division it moves to.
      const scope = await divisionScope(req.auth);
      if (!inScope(scope, found[0].division)) {
        throw Errors.forbidden('You can change alumni only in your own division.');
      }
      if (v.division !== undefined && !inScope(scope, v.division)) {
        throw Errors.forbidden('You can move alumni only into your own division.');
      }

      const params = [req.params.id];
      const sets = keys.map((key) => {
        params.push(v[key]);
        return `${FIELDS[key]} = $${params.length}`;
      });
      params.push(req.auth.userId);
      sets.push(`updated_by = $${params.length}`, 'updated_at = now()');

      const { rows } = await db.query(
        `UPDATE alumni_records SET ${sets.join(', ')}
          WHERE id = $1
        RETURNING ${RECORD_COLUMNS}`,
        params
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'ALUMNI_RECORD_UPDATED',
        entityType: 'alumni_record',
        entityId: req.params.id,
        result: 'success',
        metadata: { fieldsChanged: keys },
      });

      return res.json({ record: serialize(rows[0]) });
    } catch (err) {
      return next(err);
    }
  }
);

// No DELETE route. Alumni records are kept, and status changes hide them instead.

module.exports = router;

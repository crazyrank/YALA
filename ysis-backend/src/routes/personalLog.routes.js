const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

/**
 * Principal's personal log. Private: every query is limited to the signed-in
 * Principal's own rows, so no id sent by the phone can reach anyone else's entry.
 * Entry text is never written to the audit log.
 */
const router = express.Router();

const MAX_BODY = 10000;
const MAX_TITLE = 120;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const COLUMNS = `id, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, title, body,
  created_at, updated_at`;

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
}

function isRealDate(text) {
  if (typeof text !== 'string' || !DATE_PATTERN.test(text)) return false;
  const d = new Date(text + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

function cleanBody(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) throw Errors.badRequest('BODY_REQUIRED', 'Write something first.');
  if (text.length > MAX_BODY) {
    throw Errors.badRequest('BODY_TOO_LONG', `Keep the entry under ${MAX_BODY} characters.`);
  }
  return text;
}

function cleanTitle(raw) {
  if (raw === undefined || raw === null) return null;
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text.length > MAX_TITLE) {
    throw Errors.badRequest('TITLE_TOO_LONG', `Keep the title under ${MAX_TITLE} characters.`);
  }
  return text || null;
}

async function lagosToday() {
  const { rows } = await db.query(
    `SELECT to_char((now() AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS today`
  );
  return rows[0].today;
}

/** GET /personal-log?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N  (own entries, newest first) */
router.get(
  '/',
  requireAuth,
  requireRole('principal'),
  [
    query('from').optional().matches(DATE_PATTERN),
    query('to').optional().matches(DATE_PATTERN),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const from = req.query.from || '2000-01-01';
      const to = req.query.to || '2100-12-31';
      const limit = parseInt(req.query.limit || '100', 10);
      const { rows } = await db.query(
        `SELECT ${COLUMNS}
           FROM personal_log_entries
          WHERE owner_id = $1 AND deleted_at IS NULL
            AND entry_date BETWEEN $2::date AND $3::date
          ORDER BY entry_date DESC, created_at DESC
          LIMIT $4`,
        [req.auth.userId, from, to, limit]
      );
      return res.json({ entries: rows });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /personal-log/changes?since=<ISO>&afterId=<uuid>&limit=<n>
 * Phone sync feed: own entries only, oldest change first, deletes included.
 */
router.get(
  '/changes',
  requireAuth,
  requireRole('principal'),
  [
    query('since').optional().isISO8601(),
    query('afterId').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const since = req.query.since || '1970-01-01T00:00:00.000Z';
      const afterId = req.query.afterId || '00000000-0000-0000-0000-000000000000';
      const limit = parseInt(req.query.limit || '200', 10);
      const { rows } = await db.query(
        `SELECT ${COLUMNS}, deleted_at
           FROM personal_log_entries
          WHERE owner_id = $1
            AND (updated_at, id) > ($2::timestamptz, $3::uuid)
          ORDER BY updated_at ASC, id ASC
          LIMIT $4`,
        [req.auth.userId, since, afterId, limit + 1]
      );
      const hasMore = rows.length > limit;
      const page = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
        id: r.id,
        entryDate: r.entry_date,
        title: r.title,
        body: r.body,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deleted: !!r.deleted_at,
      }));
      return res.json({ rows: page, hasMore });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /personal-log   body { id?, entryDate, title?, body }
 * id is optional and comes from the phone, so a retry after a dropped
 * connection does not create a second entry.
 */
router.post(
  '/',
  requireAuth,
  requireRole('principal'),
  [
    body('id').optional().isUUID(),
    body('entryDate').isString(),
    body('body').isString(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      if (!isRealDate(req.body.entryDate)) throw Errors.badRequest('DATE_INVALID', 'Choose a valid date.');
      if (req.body.entryDate > (await lagosToday())) {
        throw Errors.badRequest('DATE_IN_FUTURE', 'An entry cannot be dated in the future.');
      }
      const text = cleanBody(req.body.body);
      const title = cleanTitle(req.body.title);

      const { rows } = await db.query(
        `INSERT INTO personal_log_entries (id, owner_id, entry_date, title, body)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING
         RETURNING ${COLUMNS}`,
        [req.body.id || null, req.auth.userId, req.body.entryDate, title, text]
      );

      let entry = rows[0];
      if (!entry) {
        // Same id again: fine if it is this Principal's own earlier write (a retry).
        const { rows: own } = await db.query(
          `SELECT ${COLUMNS} FROM personal_log_entries WHERE id = $1 AND owner_id = $2`,
          [req.body.id, req.auth.userId]
        );
        if (!own[0]) throw Errors.badRequest('ID_IN_USE', 'That entry could not be saved. Try again.');
        entry = own[0];
        return res.status(200).json({ entry });
      }

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'PERSONAL_LOG_CREATED',
        entityType: 'personal_log_entry',
        entityId: entry.id,
        result: 'success',
      });
      return res.status(201).json({ entry });
    } catch (err) {
      return next(err);
    }
  }
);

/** PATCH /personal-log/:id   body { title?, body }  (own entry, any time) */
router.patch(
  '/:id',
  requireAuth,
  requireRole('principal'),
  [param('id').isUUID(), body('body').isString()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const text = cleanBody(req.body.body);
      const hasTitle = Object.prototype.hasOwnProperty.call(req.body, 'title');
      const title = hasTitle ? cleanTitle(req.body.title) : null;

      const { rows } = await db.query(
        `UPDATE personal_log_entries
            SET body = $3,
                title = CASE WHEN $4::boolean THEN $5 ELSE title END,
                updated_at = now()
          WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
          RETURNING ${COLUMNS}`,
        [req.params.id, req.auth.userId, text, hasTitle, title]
      );
      if (!rows[0]) throw Errors.notFound('That entry could not be found.');

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'PERSONAL_LOG_EDITED',
        entityType: 'personal_log_entry',
        entityId: req.params.id,
        result: 'success',
      });
      return res.json({ entry: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

/** DELETE /personal-log/:id   (own entry; soft delete so the phone can sync it) */
router.delete(
  '/:id',
  requireAuth,
  requireRole('principal'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { rows } = await db.query(
        `UPDATE personal_log_entries
            SET deleted_at = now(), updated_at = now()
          WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
          RETURNING id`,
        [req.params.id, req.auth.userId]
      );
      if (!rows[0]) throw Errors.notFound('That entry could not be found.');

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'PERSONAL_LOG_DELETED',
        entityType: 'personal_log_entry',
        entityId: req.params.id,
        result: 'success',
      });
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

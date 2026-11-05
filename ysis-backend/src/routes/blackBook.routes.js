const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

const router = express.Router();
const MAX_BODY = 4000;

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

function cleanBody(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) throw Errors.badRequest('BODY_REQUIRED', 'Write the entry before saving.');
  if (text.length > MAX_BODY) {
    throw Errors.badRequest('BODY_TOO_LONG', `Keep the entry under ${MAX_BODY} characters.`);
  }
  return text;
}

const ENTRY_COLUMNS = `id, to_char(entry_date, 'YYYY-MM-DD') AS entry_date,
  body, original_body, written_by, written_at, corrected_at, correction_count`;

// Corrections are allowed at any time, but only by the Principal who wrote the entry.
function serialize(row, userId) {
  return {
    id: row.id,
    entryDate: row.entry_date,
    body: row.body,
    originalBody: row.original_body,
    writtenBy: row.written_by,
    writtenAt: row.written_at,
    correctedAt: row.corrected_at,
    correctionCount: row.correction_count,
    canEdit: row.written_by === userId,
  };
}

// Principal only. The Black Book is not visible to any other role.
router.get('/', requireAuth, requireRole('principal'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ${ENTRY_COLUMNS} FROM black_book_entries ORDER BY written_at DESC`
    );
    return res.json({ entries: rows.map((r) => serialize(r, req.auth.userId)) });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/',
  requireAuth,
  requireRole('principal'),
  [body('body').isString()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const text = cleanBody(req.body.body);

      const { rows } = await db.query(
        `INSERT INTO black_book_entries (body, written_by)
         VALUES ($1, $2)
         RETURNING ${ENTRY_COLUMNS}`,
        [text, req.auth.userId]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'BLACK_BOOK_ENTRY_CREATED',
        entityType: 'black_book_entry',
        entityId: rows[0].id,
        result: 'success',
        metadata: {},
      });

      return res.status(201).json({ entry: serialize(rows[0], req.auth.userId) });
    } catch (err) {
      return next(err);
    }
  }
);

// The writer can correct at any time. The first text is always kept.
router.patch(
  '/:id',
  requireAuth,
  requireRole('principal'),
  [param('id').isUUID(), body('body').isString()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const text = cleanBody(req.body.body);

      const { rows: found } = await db.query(
        'SELECT id, written_by FROM black_book_entries WHERE id = $1',
        [req.params.id]
      );
      if (!found[0]) throw Errors.notFound('That entry could not be found.');
      if (found[0].written_by !== req.auth.userId) {
        throw Errors.forbidden('Only the person who wrote this entry can correct it.');
      }

      const { rows } = await db.query(
        `UPDATE black_book_entries
            SET original_body = COALESCE(original_body, body),
                body = $2,
                corrected_at = now(),
                correction_count = correction_count + 1
          WHERE id = $1
            AND written_by = $3
        RETURNING ${ENTRY_COLUMNS}`,
        [req.params.id, text, req.auth.userId]
      );
      if (!rows[0]) throw Errors.notFound('That entry could not be found.');

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'BLACK_BOOK_ENTRY_CORRECTED',
        entityType: 'black_book_entry',
        entityId: req.params.id,
        result: 'success',
        metadata: { correctionCount: rows[0].correction_count },
      });

      return res.json({ entry: serialize(rows[0], req.auth.userId) });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

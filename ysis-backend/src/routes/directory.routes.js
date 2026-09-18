const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { uploadDirectoryPhoto } = require('../services/photoService');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

const SECTION_CREATORS = {
  board: ['director'],
  management: ['director', 'principal'],
  class_teacher: ['director', 'principal', 'head_teacher'],
};

const VISIBLE_SECTIONS_BY_ROLE = {
  director: ['board', 'management', 'class_teacher'],
  principal: ['management', 'class_teacher'],
  head_teacher: ['class_teacher'],
};

function serialize(row) {
  return {
    id: row.id,
    section: row.section,
    fullName: row.full_name,
    title: row.title,
    photoUrl: row.photo_url,
    linkedUserId: row.linked_user_id,
    createdAt: row.created_at,
  };
}

/**
 * GET /directory
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const sections = VISIBLE_SECTIONS_BY_ROLE[req.auth.role] || [];
    if (sections.length === 0) {
      return res.json({ board: [], management: [], classTeachers: [] });
    }

    const { rows } = await db.query(
      `SELECT id, section, full_name, title, photo_url, linked_user_id, created_at
       FROM staff_directory
       WHERE section = ANY($1::directory_section[])
       ORDER BY created_at ASC`,
      [sections]
    );

    const grouped = { board: [], management: [], classTeachers: [] };
    for (const row of rows) {
      const entry = serialize(row);
      if (row.section === 'board') grouped.board.push(entry);
      else if (row.section === 'management') grouped.management.push(entry);
      else grouped.classTeachers.push(entry);
    }

    return res.json(grouped);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /directory
 */
router.post(
  '/',
  requireAuth,
  [
    body('section').isIn(['board', 'management', 'class_teacher']),
    body('fullName').isString().trim().notEmpty(),
    body('title').isString().trim().notEmpty(),
    body('photoBase64').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { section, fullName, title, photoBase64 } = req.body;

      const allowed = SECTION_CREATORS[section] || [];
      if (!allowed.includes(req.auth.role)) {
        throw Errors.forbidden('You are not able to add entries to this section.');
      }

      const { rows: inserted } = await db.query(
        `INSERT INTO staff_directory (section, full_name, title, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [section, fullName.trim(), title.trim(), req.auth.userId]
      );
      const id = inserted[0].id;

      if (photoBase64) {
        const photoUrl = await uploadDirectoryPhoto(photoBase64, id);
        await db.query('UPDATE staff_directory SET photo_url = $2 WHERE id = $1', [id, photoUrl]);
      }

      const { rows } = await db.query('SELECT * FROM staff_directory WHERE id = $1', [id]);

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'DIRECTORY_ENTRY_CREATED',
        entityType: 'staff_directory',
        entityId: id,
        result: 'success',
        metadata: { section },
      });

      return res.status(201).json({ entry: serialize(rows[0]) });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /directory/:id
 */
router.patch(
  '/:id',
  requireAuth,
  [
    param('id').isUUID(),
    body('fullName').optional().isString().trim().notEmpty(),
    body('title').optional().isString().trim().notEmpty(),
    body('photoBase64').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { id } = req.params;

      const { rows } = await db.query(
        'SELECT id, section, linked_user_id FROM staff_directory WHERE id = $1',
        [id]
      );
      const existing = rows[0];
      if (!existing) throw Errors.notFound('That staff directory entry could not be found.');

      const allowed = SECTION_CREATORS[existing.section] || [];
      if (!allowed.includes(req.auth.role)) {
        throw Errors.forbidden('You are not able to edit this entry.');
      }
      if (existing.linked_user_id) {
        throw Errors.forbidden('This card is linked to a login account and updates automatically.');
      }

      const { fullName, title, photoBase64 } = req.body;
      let photoUrl = null;
      if (photoBase64) {
        photoUrl = await uploadDirectoryPhoto(photoBase64, id);
      }

      const { rows: updatedRows } = await db.query(
        `UPDATE staff_directory
         SET full_name = COALESCE($2, full_name),
             title = COALESCE($3, title),
             photo_url = COALESCE($4, photo_url),
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [id, fullName ? fullName.trim() : null, title ? title.trim() : null, photoUrl]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'DIRECTORY_ENTRY_UPDATED',
        entityType: 'staff_directory',
        entityId: id,
        result: 'success',
      });

      return res.json({ entry: serialize(updatedRows[0]) });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /directory/:id
 */
router.delete(
  '/:id',
  requireAuth,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { id } = req.params;

      const { rows } = await db.query(
        'SELECT id, section, linked_user_id FROM staff_directory WHERE id = $1',
        [id]
      );
      const existing = rows[0];
      if (!existing) throw Errors.notFound('That staff directory entry could not be found.');

      const allowed = SECTION_CREATORS[existing.section] || [];
      if (!allowed.includes(req.auth.role)) {
        throw Errors.forbidden('You are not able to remove this entry.');
      }
      if (existing.linked_user_id) {
        throw Errors.forbidden('This card is linked to a login account and cannot be removed here.');
      }

      await db.query('DELETE FROM staff_directory WHERE id = $1', [id]);

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'DIRECTORY_ENTRY_REMOVED',
        entityType: 'staff_directory',
        entityId: id,
        result: 'success',
      });

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

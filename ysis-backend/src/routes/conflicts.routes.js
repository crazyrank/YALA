const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
}

/** GET /conflicts?status=open — Principal/Director only (blocking dashboard element) */
router.get('/', requireAuth, requireRole('principal', 'director'), async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    const { rows } = await db.query(
      `SELECT c.*, s.full_name, s.admission_no
       FROM conflicts c JOIN students s ON s.id = c.student_id
       WHERE c.status = $1 ORDER BY c.detected_at ASC`,
      [status]
    );
    return res.json({ conflicts: rows });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /conflicts/:id/resolve
 * resolution: 'restore' (apply incoming_change over server_state),
 *             'keep_deleted' (discard incoming_change, no-op on students),
 *             'manual_merge' (Principal supplies the final field values directly)
 */
router.post(
  '/:id/resolve',
  requireAuth,
  requireRole('principal', 'director'),
  [body('resolution').isIn(['restore', 'keep_deleted', 'manual_merge'])],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { resolution, manualFields, notes } = req.body;

      const { rows } = await db.query('SELECT * FROM conflicts WHERE id = $1', [req.params.id]);
      const conflict = rows[0];
      if (!conflict) throw Errors.notFound('That conflict could not be found.');
      if (conflict.status !== 'open') throw Errors.badRequest('ALREADY_RESOLVED', 'This conflict was already resolved.');

      if (resolution === 'restore') {
        const changes = conflict.incoming_change.changes || {};
        const setFields = Object.keys(changes);
        if (setFields.length > 0) {
          const setClauses = setFields.map((f, i) => `${f} = $${i + 2}`).join(', ');
          await db.query(
            `UPDATE students SET ${setClauses}, sync_version = sync_version + 1, updated_at = now() WHERE id = $1`,
            [conflict.student_id, ...setFields.map((f) => changes[f])]
          );
        }
      } else if (resolution === 'manual_merge' && manualFields) {
        const setFields = Object.keys(manualFields);
        if (setFields.length > 0) {
          const setClauses = setFields.map((f, i) => `${f} = $${i + 2}`).join(', ');
          await db.query(
            `UPDATE students SET ${setClauses}, sync_version = sync_version + 1, updated_at = now() WHERE id = $1`,
            [conflict.student_id, ...setFields.map((f) => manualFields[f])]
          );
        }
      }
      // 'keep_deleted' => intentionally no student mutation

      await db.query(
        `UPDATE conflicts SET status = 'resolved', resolved_by = $2, resolution = $3, resolved_at = now()
         WHERE id = $1`,
        [req.params.id, req.auth.userId, resolution]
      );

      await writeAudit({
        userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'CONFLICT_RESOLVED',
        entityType: 'student', entityId: conflict.student_id, result: 'success',
        metadata: { resolution, notes },
      });

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  }
);

/** GET /admission-merge-queue?status=open */
router.get('/admission-merge-queue/list', requireAuth, requireRole('principal', 'director'), async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    const { rows } = await db.query(
      `SELECT mq.*,
              a.full_name AS record_a_name, a.class_level AS record_a_class,
              b.full_name AS record_b_name, b.class_level AS record_b_class
       FROM admission_merge_queue mq
       JOIN students a ON a.id = mq.record_a_id
       JOIN students b ON b.id = mq.record_b_id
       WHERE mq.status = $1 ORDER BY mq.detected_at ASC`,
      [status]
    );
    return res.json({ mergeQueue: rows });
  } catch (err) {
    return next(err);
  }
});

/** POST /admission-merge-queue/:id/resolve — body { canonicalId, discardedId } */
router.post(
  '/admission-merge-queue/:id/resolve',
  requireAuth,
  requireRole('principal', 'director'),
  [body('canonicalId').isUUID(), body('discardedId').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { canonicalId, discardedId } = req.body;

      const { rows } = await db.query('SELECT * FROM admission_merge_queue WHERE id = $1', [req.params.id]);
      const item = rows[0];
      if (!item) throw Errors.notFound('That item could not be found.');
      if (item.status !== 'open') throw Errors.badRequest('ALREADY_RESOLVED', 'This was already resolved.');

      // Hard delete the discarded row — the ONE place in this schema
      // where a hard delete is correct, since it was never a real second
      // student (Build Spec Section 6).
      await db.query('DELETE FROM students WHERE id = $1', [discardedId]);

      await db.query(
        `UPDATE admission_merge_queue
         SET status = 'resolved', resolved_by = $2, canonical_id = $3, discarded_id = $4, resolved_at = now()
         WHERE id = $1`,
        [req.params.id, req.auth.userId, canonicalId, discardedId]
      );

      // Notify: any Head Teacher device that had the discarded record
      // will see "this record was merged" the next time it opens that
      // student — implemented client-side by checking canonical_id
      // against the merge queue for a 404'd/discarded id.

      await writeAudit({
        userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'ADMISSION_MERGE_RESOLVED',
        entityType: 'student', entityId: canonicalId, result: 'success',
        metadata: { discardedId },
      });

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

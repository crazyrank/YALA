const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { getScopeForUser } = require('../services/studentScopeService');
const {
  MONTH_PATTERN,
  EDIT_WINDOW_HOURS,
  validateReport,
  canWriteAbout,
} = require('../utils/staffReportRules');

const router = express.Router();

const VIEW_ROLES = ['principal', 'director', 'head_teacher'];
const WRITE_ROLES = ['principal', 'head_teacher'];

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

async function currentSchoolMonth() {
  const { rows } = await db.query(
    `SELECT to_char((now() AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM') AS month`
  );
  return rows[0].month;
}

// Divisions a Head Teacher can reach. Principal and Director are unscoped, so this returns [].
async function divisionsFor(auth) {
  if (auth.role !== 'head_teacher') return [];
  const scope = await getScopeForUser(auth);
  return [...new Set((scope || []).map((s) => s.division))];
}

const REPORT_SELECT = `
  SELECT r.id, r.subject_id, r.score, r.comment, r.original_comment, r.recognition,
         r.written_by, r.written_at, r.corrected_at, r.correction_count,
         w.full_name AS written_by_name,
         (now() - r.written_at) <= make_interval(hours => ${EDIT_WINDOW_HOURS}) AS within_window
    FROM staff_reports r
    JOIN users w ON w.id = r.written_by`;

function serializeReport(row, userId) {
  return {
    id: row.id,
    score: row.score,
    comment: row.comment,
    originalComment: row.original_comment,
    recognition: row.recognition,
    writtenBy: row.written_by,
    writtenByName: row.written_by_name,
    writtenAt: row.written_at,
    correctionCount: row.correction_count,
    canEdit: row.written_by === userId && row.within_window === true,
  };
}

async function fetchReport(id, userId) {
  const { rows } = await db.query(`${REPORT_SELECT} WHERE r.id = $1`, [id]);
  return rows[0] ? serializeReport(rows[0], userId) : null;
}

async function loadSubject(id) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.role, u.status, cta.division, cta.class_level, cta.arm
       FROM users u
       LEFT JOIN class_teacher_assignments cta ON cta.user_id = u.id
      WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * GET /staff-reports?month=YYYY-MM
 * Principal and Director see every Head Teacher and Class Teacher.
 * A Head Teacher sees Class Teachers in their own division only.
 * Nobody sees their own report. Class Teachers and guests cannot open this list.
 */
router.get(
  '/',
  requireAuth,
  [query('month').optional().matches(MONTH_PATTERN)],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { role, userId } = req.auth;
      if (!VIEW_ROLES.includes(role)) {
        throw Errors.forbidden('Only the Principal, Director and Head Teachers can open staff reports.');
      }

      const currentMonth = await currentSchoolMonth();
      const month = req.query.month || currentMonth;
      const divisions = await divisionsFor(req.auth);

      const params = [userId];
      let sql = `
        SELECT u.id, u.full_name, u.role, cta.division, cta.class_level, cta.arm
          FROM users u
          LEFT JOIN class_teacher_assignments cta ON cta.user_id = u.id
         WHERE u.status = 'active'
           AND u.id <> $1
           AND u.role IN ('head_teacher', 'class_teacher')`;
      if (role === 'head_teacher') {
        params.push(divisions);
        sql += `
           AND u.role = 'class_teacher'
           AND cta.division = ANY($2::text[])`;
      }
      sql += ' ORDER BY u.full_name ASC';

      const { rows: people } = await db.query(sql, params);
      const ids = people.map((p) => p.id);

      const { rows: reportRows } = await db.query(
        `${REPORT_SELECT} WHERE r.report_month = $1 AND r.subject_id = ANY($2::uuid[])`,
        [month, ids]
      );
      const bySubject = new Map(reportRows.map((r) => [r.subject_id, serializeReport(r, userId)]));

      return res.json({
        month,
        currentMonth,
        canWrite: WRITE_ROLES.includes(role) && month === currentMonth,
        subjects: people.map((p) => ({
          id: p.id,
          fullName: p.full_name,
          role: p.role,
          division: p.division,
          classLevel: p.class_level,
          arm: p.arm,
          report: bySubject.get(p.id) || null,
        })),
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /staff-reports   body { subjectId, score, comment, recognition }
 * Writes always go to the current school month. Back-dating is not allowed.
 */
router.post(
  '/',
  requireAuth,
  requireRole(...WRITE_ROLES),
  [
    body('subjectId').isUUID(),
    body('score').exists(),
    body('comment').isString(),
    body('recognition').optional({ nullable: true }).isString(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const month = await currentSchoolMonth();

      const checked = validateReport({
        score: req.body.score,
        comment: req.body.comment,
        recognition: req.body.recognition,
      });
      if (!checked.ok) throw Errors.badRequest(checked.code, checked.message);

      const subject = await loadSubject(req.body.subjectId);
      if (!subject) throw Errors.notFound('That staff member could not be found.');

      const divisions = await divisionsFor(req.auth);
      if (!canWriteAbout({
        writerRole: req.auth.role,
        writerId: req.auth.userId,
        writerDivisions: divisions,
        subject,
      })) {
        throw Errors.forbidden('You can write reports only about staff you are responsible for.');
      }

      const { rows: existing } = await db.query(
        'SELECT id FROM staff_reports WHERE subject_id = $1 AND report_month = $2',
        [subject.id, month]
      );
      if (existing[0]) {
        throw Errors.conflict(
          'REPORT_EXISTS',
          'A report for this person has already been written this month. Correct it instead.'
        );
      }

      const { rows } = await db.query(
        `INSERT INTO staff_reports
           (subject_id, subject_division, report_month, score, comment, recognition, written_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          subject.id,
          subject.division,
          month,
          checked.value.score,
          checked.value.comment,
          checked.value.recognition,
          req.auth.userId,
        ]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STAFF_REPORT_CREATED',
        entityType: 'staff_report',
        entityId: rows[0].id,
        result: 'success',
        metadata: { reportMonth: month, score: checked.value.score },
      });

      return res.status(201).json({ report: await fetchReport(rows[0].id, req.auth.userId) });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /staff-reports/:id   body { score, comment, recognition }
 * The writer only, and only within the correction window. The first comment is kept.
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole(...WRITE_ROLES),
  [
    param('id').isUUID(),
    body('score').exists(),
    body('comment').isString(),
    body('recognition').optional({ nullable: true }).isString(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const { rows: found } = await db.query(
        `SELECT id, written_by,
                (now() - written_at) <= make_interval(hours => ${EDIT_WINDOW_HOURS}) AS within_window
           FROM staff_reports
          WHERE id = $1`,
        [req.params.id]
      );
      const report = found[0];
      if (!report) throw Errors.notFound('That report could not be found.');
      if (report.written_by !== req.auth.userId) {
        throw Errors.forbidden('Only the person who wrote this report can correct it.');
      }
      if (!report.within_window) {
        throw Errors.forbidden(`Reports can be corrected only within ${EDIT_WINDOW_HOURS} hours of being written.`);
      }

      const checked = validateReport({
        score: req.body.score,
        comment: req.body.comment,
        recognition: req.body.recognition,
      });
      if (!checked.ok) throw Errors.badRequest(checked.code, checked.message);

      await db.query(
        `UPDATE staff_reports
            SET original_comment = COALESCE(original_comment, comment),
                score = $2,
                comment = $3,
                recognition = $4,
                corrected_at = now(),
                correction_count = correction_count + 1
          WHERE id = $1`,
        [req.params.id, checked.value.score, checked.value.comment, checked.value.recognition]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STAFF_REPORT_CORRECTED',
        entityType: 'staff_report',
        entityId: req.params.id,
        result: 'success',
        metadata: { score: checked.value.score },
      });

      return res.json({ report: await fetchReport(req.params.id, req.auth.userId) });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

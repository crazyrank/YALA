const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { userHasPermission } = require('../services/permissionService');
const {
  applyConditionalUpdate,
  getCurrentServerState,
} = require('../services/studentService');
const { uploadStudentPhoto } = require('../services/photoService');
const { isAtMaxClass } = require('../utils/classProgression');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    throw Errors.badRequest(
      'VALIDATION_ERROR',
      result.array()[0].msg
    );
  }
}

/**
 * Returns the caller's class scope.
 * Principal/Director: unrestricted.
 * Head Teacher: only assigned classes.
 */
async function getScopeForUser(auth) {
  if (
    auth.role === 'principal' ||
    auth.role === 'director'
  ) {
    return null;
  }

  const { rows } = await db.query(
    `SELECT division, class_level, arm
     FROM head_teacher_class_assignments
     WHERE user_id = $1`,
    [auth.userId]
  );

  return rows;
}

function scopeToSqlClause(scope, startIndex) {
  if (!scope || scope.length === 0) {
    return {
      clause: 'FALSE',
      params: [],
    };
  }

  const clauses = [];
  const params = [];
  let idx = startIndex;

  for (const s of scope) {
    if (s.arm) {
      clauses.push(
        `(division = $${idx}
          AND class_level = $${idx + 1}
          AND arm = $${idx + 2})`
      );

      params.push(
        s.division,
        s.class_level,
        s.arm
      );

      idx += 3;
    } else {
      clauses.push(
        `(division = $${idx}
          AND class_level = $${idx + 1})`
      );

      params.push(
        s.division,
        s.class_level
      );

      idx += 2;
    }
  }

  return {
    clause: `(${clauses.join(' OR ')})`,
    params,
  };
}

/**
 * GET /students
 */
router.get(
  '/',
  requireAuth,
  [
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const {
        search,
        status,
        division,
        classLevel,
        arm,
      } = req.query;

      const page = parseInt(
        req.query.page || '1',
        10
      );

      const pageSize = 30;
      const offset = (page - 1) * pageSize;

      const scope = await getScopeForUser(req.auth);

      const params = [];
      const conditions = [];
      let idx = 1;

      if (scope !== null) {
        const {
          clause,
          params: scopeParams,
        } = scopeToSqlClause(scope, idx);

        conditions.push(clause);
        params.push(...scopeParams);
        idx += scopeParams.length;
      }

      if (status) {
        conditions.push(`status = $${idx}`);
        params.push(status);
        idx += 1;
      }

      if (division) {
        conditions.push(`division = $${idx}`);
        params.push(division);
        idx += 1;
      }

      if (classLevel) {
        conditions.push(`class_level = $${idx}`);
        params.push(classLevel);
        idx += 1;
      }

      if (arm) {
        conditions.push(`arm = $${idx}`);
        params.push(arm);
        idx += 1;
      }

      let orderClause = 'ORDER BY full_name ASC';

      if (search) {
        conditions.push(
          `full_name ILIKE $${idx}`
        );

        params.push(`%${search}%`);

        const simIdx = idx + 1;

        params.push(search);

        orderClause =
          `ORDER BY similarity(full_name, $${simIdx}) DESC,
           full_name ASC`;

        idx += 2;
      }

      const whereClause =
        conditions.length > 0
          ? `WHERE ${conditions.join(' AND ')}`
          : '';

      params.push(pageSize, offset);

      const { rows } = await db.query(
        `SELECT id,
                admission_no,
                full_name,
                division,
                class_level,
                arm,
                status,
                sync_version
         FROM students
         ${whereClause}
         ${orderClause}
         LIMIT $${idx}
         OFFSET $${idx + 1}`,
        params
      );

      return res.json({
        students: rows,
        page,
        pageSize,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /students
 */
router.post(
  '/',
  requireAuth,
  [
    body('id').isUUID(),
    body('admissionNo').isString().notEmpty(),
    body('fullName').isString().notEmpty(),
    body('division').isIn([
      'primary',
      'secondary',
    ]),
    body('classLevel').isString().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const {
        id,
        admissionNo,
        fullName,
        division,
        classLevel,
        arm,
        dateOfBirth,
        gender,
        guardianName,
        guardianPhone,
      } = req.body;

      try {
        const { rows } = await db.query(
          `INSERT INTO students
             (
               id,
               admission_no,
               full_name,
               division,
               class_level,
               arm,
               date_of_birth,
               gender,
               guardian_name,
               guardian_phone,
               registered_by,
               registered_device_id
             )
           VALUES
             (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
             )
           RETURNING *`,
          [
            id,
            admissionNo,
            fullName,
            division,
            classLevel,
            arm || null,
            dateOfBirth || null,
            gender || null,
            guardianName || null,
            guardianPhone || null,
            req.auth.userId,
            req.auth.deviceId,
          ]
        );

        await writeAudit({
          userId: req.auth.userId,
          deviceId: req.auth.deviceId,
          action: 'STUDENT_REGISTERED',
          entityType: 'student',
          entityId: id,
          result: 'success',
        });

        return res.status(201).json({
          student: rows[0],
        });
      } catch (dbErr) {
        if (
          dbErr.code === '23505' &&
          dbErr.constraint ===
            'students_admission_no_key'
        ) {
          const existing = await db.query(
            `SELECT id
             FROM students
             WHERE admission_no = $1`,
            [admissionNo]
          );

          const existingId =
            existing.rows[0]?.id;

          if (
            existingId &&
            existingId !== id
          ) {
            await db.query(
              `INSERT INTO admission_merge_queue
                 (
                   admission_no,
                   record_a_id,
                   record_b_id
                 )
               VALUES ($1, $2, $3)`,
              [
                admissionNo,
                existingId,
                id,
              ]
            );

            throw Errors.conflict(
              'ADMISSION_NUMBER_COLLISION',
              'This admission number is already in use and has been sent to the Principal to reconcile.'
            );
          }
        }

        throw dbErr;
      }
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /students/:id
 */
router.patch(
  '/:id',
  requireAuth,
  [
    body('basedOnVersion')
      .isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const {
        basedOnVersion,
        ...changes
      } = req.body;

      const result =
        await applyConditionalUpdate({
          studentId: req.params.id,
          basedOnVersion,
          changes,
        });

      if (!result.updated) {
        throw Errors.conflict(
          'CONFLICT_VERSION_MISMATCH',
          'This record was changed by someone else. Please refresh and try again.'
        );
      }

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STUDENT_EDITED',
        entityType: 'student',
        entityId: req.params.id,
        result: 'success',
      });

      return res.json({
        student: result.student,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /students/:id/promote
 *
 * Principal/Director can promote directly.
 * Head Teacher requires a live PROMOTE_STUDENT permission.
 *
 * IMPORTANT:
 * The server checks the student's CURRENT class before applying
 * the promotion. SS3 is the hard ceiling.
 */
router.post(
  '/:id/promote',
  requireAuth,
  [
    body('newClassLevel')
      .isString()
      .notEmpty(),

    body('basedOnVersion')
      .isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      if (
        req.auth.role !== 'principal' &&
        req.auth.role !== 'director'
      ) {
        const allowed =
          await userHasPermission({
            userId: req.auth.userId,
            role: req.auth.role,
            permissionCode:
              'PROMOTE_STUDENT',
            atTime: new Date(),
          });

        if (!allowed) {
          throw Errors.forbidden(
            'You do not have permission to promote students right now.'
          );
        }
      }

      const currentStudent =
        await getCurrentServerState(
          req.params.id
        );

      if (!currentStudent) {
        throw Errors.notFound(
          'That student could not be found.'
        );
      }

      if (
        isAtMaxClass(
          currentStudent.class_level
        )
      ) {
        throw Errors.badRequest(
          'ALREADY_AT_MAX_CLASS',
          'This student is already at SS3, the highest class. They should be graduated, not promoted.'
        );
      }

      const result =
        await applyConditionalUpdate({
          studentId: req.params.id,
          basedOnVersion:
            req.body.basedOnVersion,

          changes: {
            class_level:
              req.body.newClassLevel,

            status: 'promoted',
          },
        });

      if (!result.updated) {
        throw Errors.conflict(
          'CONFLICT_VERSION_MISMATCH',
          'This record changed before the promotion could be applied.'
        );
      }

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STUDENT_PROMOTED',
        entityType: 'student',
        entityId: req.params.id,
        result: 'success',

        metadata: {
          newClassLevel:
            req.body.newClassLevel,
        },
      });

      return res.json({
        student: result.student,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /students/:id/photo
 *
 * Online-only equivalent of the queued upload_photo operation.
 */
router.post(
  '/:id/photo',
  requireAuth,
  [
    body('imageBase64')
      .isString()
      .notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const result =
        validationResult(req);

      if (!result.isEmpty()) {
        throw Errors.badRequest(
          'VALIDATION_ERROR',
          result.array()[0].msg
        );
      }

      const photo =
        await uploadStudentPhoto({
          studentId: req.params.id,
          uploaderId: req.auth.userId,
          uploaderRole: req.auth.role,
          deviceId: req.auth.deviceId,
          imageBase64:
            req.body.imageBase64,
          correctionReason:
            req.body.correctionReason,
        });

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,

        action: photo.approved_by
          ? 'STUDENT_PHOTO_CORRECTED'
          : 'STUDENT_PHOTO_UPLOADED',

        entityType: 'student',
        entityId: req.params.id,
        result: 'success',

        metadata:
          req.body.correctionReason
            ? {
                correctionReason:
                  req.body.correctionReason,
              }
            : null,
      });

      return res.status(201).json({
        photo,
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

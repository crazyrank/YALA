const { planPromotion, validateEdit } = require('../utils/studentChangeRules');
const { normalizeStudent } = require('../utils/studentRules');
const { academicSessionFor, normalizeSession } = require('../utils/academicSession');
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { userHasPermission } = require('../services/permissionService');
const {
  applyConditionalUpdate,
  getCurrentServerState,
} = require('../services/studentService');
const {
  getScopeForUser,
  scopeToSqlClause,
  isWithinScope,
} = require('../services/studentScopeService');
const { uploadStudentPhoto, signedStudentPhotoUrl } = require('../services/photoService');
const { isAtMaxClass, getNextClass, CLASS_ORDER } = require('../utils/classProgression');
const { planLeave, guestStatusFor } = require('../utils/leaveRules');
const { approvalStatusForRegistration, planApproval, planReturn, planResubmit, classTeacherMayEdit } = require('../utils/approvalRules');

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
 * GET /students
 */
router.get(
  '/',
  requireAuth,
  [
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('status').optional().isIn([
      'registered', 'active', 'promoted', 'graduated',
      'transferred', 'withdrawn', 'expelled', 'archived',
    ]),
    query('division').optional().isIn(['primary', 'secondary']),
    query('classLevel').optional().isIn(CLASS_ORDER),
    query('arm').optional().isString(),
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

      // Count all records matching the same access scope and filters.
      // This runs before pagination parameters are added.
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM students
         ${whereClause}`,
        params
      );

      const total = Number(countResult.rows[0]?.total || 0);

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

      const visibleStudents = req.auth.role === 'guest'
        ? rows.map((student) => ({
            id: student.id,
            admission_no: student.admission_no,
            full_name: student.full_name,
            class_level: student.class_level,
            status: guestStatusFor(student.status),
          }))
        : rows;

      if (req.auth.role === 'guest') {
        await writeAudit({
          userId: req.auth.userId,
          deviceId: req.auth.deviceId,
          action: 'GUEST_STUDENT_LIST_VIEWED',
          entityType: 'student_collection',
          result: 'success',
          metadata: { returned: rows.length, total, page },
        });
      }

      return res.json({
        students: visibleStudents,
        page,
        pageSize,
        total,
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
  requireRole('principal', 'director', 'head_teacher', 'class_teacher'),
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

      let {
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
        academicSession,
      } = req.body;

      // Shared rules: class, arm by class, gender M/F, optional date of birth.
      const norm = normalizeStudent({
        admissionNo,
        fullName,
        division,
        classLevel,
        arm,
        gender,
        guardianName,
        guardianPhone,
        dateOfBirth,
      });
      if (!norm.ok) {
        throw Errors.badRequest('VALIDATION_ERROR', norm.errors[0]);
      }
      ({
        admissionNo,
        fullName,
        division,
        classLevel,
        arm,
        gender,
        guardianName,
        guardianPhone,
        dateOfBirth,
      } = norm.value);

      // Session the student was admitted. Defaults to the current session.
      let sessionValue = null;
      if (academicSession === undefined || academicSession === null || academicSession === '') {
        sessionValue = academicSessionFor(new Date());
      } else {
        sessionValue = normalizeSession(academicSession);
        if (!sessionValue) {
          throw Errors.badRequest('VALIDATION_ERROR', 'academicSession: not a session the school can choose');
        }
      }

      // Security fix: a head_teacher could previously register a student
      // into ANY division/class by simply putting it in the request body.
      // Registration must land inside the caller's own assigned scope.
      const scope = await getScopeForUser(req.auth);

      if (
        !isWithinScope(scope, {
          division,
          classLevel,
          arm: arm || null,
        })
      ) {
        throw Errors.forbidden(
          'You do not have permission to register students in this class.'
        );
      }

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
               registered_device_id,
               academic_session,
               approval_status
             )
           VALUES
             (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
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
            sessionValue,
            approvalStatusForRegistration(req.auth.role),
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
    param('id').isUUID(),
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

      // Security fix: previously this route trusted `changes` completely,
      // so a head_teacher could edit (or division-hop) a student outside
      // their scope. Both the student's CURRENT class and, if the edit
      // touches division/class_level/arm, its RESULTING class must be
      // inside the caller's scope.
      const currentStudent = await getCurrentServerState(
        req.params.id
      );

      if (!currentStudent) {
        throw Errors.notFound(
          'That student could not be found.'
        );
      }

      const scope = await getScopeForUser(req.auth);

      if (
        !isWithinScope(scope, {
          division: currentStudent.division,
          classLevel: currentStudent.class_level,
          arm: currentStudent.arm,
        })
      ) {
        throw Errors.forbidden(
          'You do not have permission to edit this student.'
        );
      }

      // Head teachers may edit every profile field inside their own scope.
      // Archive and restore stay with the Principal and Director.
      if (req.auth.role === 'head_teacher' && 'status' in changes) {
        throw Errors.forbidden('Head teachers cannot archive or restore students.');
      }

      // Class teachers edit a record only while it is Pending or Returned, and
      // never change its status. Approved records are for the Principal or Director.
      if (req.auth.role === 'class_teacher') {
        if ('status' in changes) {
          throw Errors.forbidden('Class teachers cannot archive or restore students.');
        }
        if (!classTeacherMayEdit(currentStudent)) {
          throw Errors.forbidden('Approved records can only be edited by the Principal or Director.');
        }
      }

      const touchesClassFields = [
        'division',
        'class_level',
        'arm',
      ].some((field) => field in changes);

      if (touchesClassFields) {
        const nextDivision =
          'division' in changes
            ? changes.division
            : currentStudent.division;

        const nextClassLevel =
          'class_level' in changes
            ? changes.class_level
            : currentStudent.class_level;

        const nextArm =
          'arm' in changes
            ? changes.arm
            : currentStudent.arm;

        if (
          !isWithinScope(scope, {
            division: nextDivision,
            classLevel: nextClassLevel,
            arm: nextArm,
          })
        ) {
          throw Errors.forbidden(
            'You do not have permission to move this student into that class.'
          );
        }
      }

      const edit = validateEdit(currentStudent, changes);
      if (!edit.ok) {
        throw Errors.badRequest(edit.code, edit.message);
      }

      const result =
        await applyConditionalUpdate({
          studentId: req.params.id,
          basedOnVersion,
          changes: edit.changes,
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
 */
router.post(
  '/:id/promote',
  requireAuth,
  requireRole('principal', 'director'),
  [
    param('id').isUUID(),

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

      // Security fix: PROMOTE_STUDENT only ever checked a role-level
      // permission, never whether THIS student is inside the caller's
      // division/class scope. A Secondary HT with delegated promote
      // rights could previously promote any Primary student too.
      const scope = await getScopeForUser(req.auth);

      if (
        !isWithinScope(scope, {
          division: currentStudent.division,
          classLevel: currentStudent.class_level,
          arm: currentStudent.arm,
        })
      ) {
        throw Errors.forbidden(
          'You do not have permission to promote this student.'
        );
      }

      const plan = planPromotion(currentStudent, {
        newClassLevel: req.body.newClassLevel,
        arm: req.body.arm,
      });
      if (!plan.ok) {
        throw Errors.badRequest(plan.code, plan.message);
      }

      const result = await applyConditionalUpdate({
        studentId: req.params.id,
        basedOnVersion: req.body.basedOnVersion,
        changes: plan.changes,
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
 * Registration approval. Pending registrations are approved or returned by the
 * Head Teacher of that division (or the Principal or Director). A returned
 * registration is fixed and resubmitted by the Class Teacher who made it.
 * Each change checks the caller's scope and the record version, bumps the version
 * so phones receive it, and is written to the audit log.
 */
async function changeApproval(req, { auditAction, buildPlan }) {
  const current = await getCurrentServerState(req.params.id);
  if (!current) {
    throw Errors.notFound('That student could not be found.');
  }

  const scope = await getScopeForUser(req.auth);
  if (
    !isWithinScope(scope, {
      division: current.division,
      classLevel: current.class_level,
      arm: current.arm,
    })
  ) {
    throw Errors.forbidden('You do not have permission to update this student.');
  }

  const plan = buildPlan(current);
  if (!plan.ok) {
    throw Errors.badRequest(plan.code, plan.message);
  }

  const approving = plan.changes.approval_status === 'approved';
  const { rows } = await db.query(
    `UPDATE students
        SET approval_status = $3,
            return_reason = $4,
            approved_by = ${approving ? '$5' : 'NULL'},
            approved_at = ${approving ? 'now()' : 'NULL'},
            sync_version = sync_version + 1,
            updated_at = now()
      WHERE id = $1 AND sync_version = $2
      RETURNING *`,
    approving
      ? [req.params.id, req.body.basedOnVersion, plan.changes.approval_status, plan.changes.return_reason, req.auth.userId]
      : [req.params.id, req.body.basedOnVersion, plan.changes.approval_status, plan.changes.return_reason]
  );
  if (rows.length === 0) {
    throw Errors.conflict(
      'CONFLICT_VERSION_MISMATCH',
      'This record changed before your update could be saved. Refresh and try again.'
    );
  }

  await writeAudit({
    userId: req.auth.userId,
    deviceId: req.auth.deviceId,
    action: auditAction,
    entityType: 'student',
    entityId: req.params.id,
    result: 'success',
    metadata: { from: current.approval_status, to: plan.changes.approval_status },
  });

  return rows[0];
}

/** POST /students/:id/approve */
router.post(
  '/:id/approve',
  requireAuth,
  requireRole('head_teacher', 'principal', 'director'),
  [param('id').isUUID(), body('basedOnVersion').isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const student = await changeApproval(req, {
        auditAction: 'STUDENT_REGISTRATION_APPROVED',
        buildPlan: (current) => planApproval(current),
      });
      return res.json({ student });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /students/:id/return  body { reason } */
router.post(
  '/:id/return',
  requireAuth,
  requireRole('head_teacher', 'principal', 'director'),
  [
    param('id').isUUID(),
    body('reason').isString().isLength({ min: 1, max: 500 }),
    body('basedOnVersion').isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const student = await changeApproval(req, {
        auditAction: 'STUDENT_REGISTRATION_RETURNED',
        buildPlan: (current) => planReturn(current, req.body.reason),
      });
      return res.json({ student });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /students/:id/resubmit  (the Class Teacher who registered it) */
router.post(
  '/:id/resubmit',
  requireAuth,
  requireRole('class_teacher'),
  [param('id').isUUID(), body('basedOnVersion').isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const student = await changeApproval(req, {
        auditAction: 'STUDENT_REGISTRATION_RESUBMITTED',
        buildPlan: (current) => planResubmit(current, req.auth.userId),
      });
      return res.json({ student });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /students/:id/leave
 * Records that a student has left (graduated, transferred, withdrawn, expelled,
 * deceased or not admitted). Only the Principal and Director may record a leave.
 * The status change and the leave record are saved together or not at all.
 */
router.post(
  '/:id/leave',
  requireAuth,
  requireRole('principal', 'director'),
  [
    param('id').isUUID(),
    body('leaveType').isString().notEmpty(),
    body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
    body('basedOnVersion').isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const currentStudent = await getCurrentServerState(req.params.id);
      if (!currentStudent) {
        throw Errors.notFound('That student could not be found.');
      }

      const scope = await getScopeForUser(req.auth);
      if (
        !isWithinScope(scope, {
          division: currentStudent.division,
          classLevel: currentStudent.class_level,
          arm: currentStudent.arm,
        })
      ) {
        throw Errors.forbidden('You do not have permission to update this student.');
      }

      const plan = planLeave(currentStudent, {
        leaveType: req.body.leaveType,
        reason: req.body.reason,
      });
      if (!plan.ok) {
        throw Errors.badRequest(plan.code, plan.message);
      }

      const saved = await db.withTransaction(async (client) => {
        const updated = await client.query(
          `UPDATE students
              SET status = $3,
                  sync_version = sync_version + 1,
                  updated_at = now()
            WHERE id = $1 AND sync_version = $2
            RETURNING *`,
          [req.params.id, req.body.basedOnVersion, plan.changes.status]
        );
        if (updated.rows.length === 0) return null;

        const leave = await client.query(
          `INSERT INTO student_leaves (student_id, leave_type, leave_session, reason, recorded_by, previous_status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, leave_type, leave_session, reason, recorded_at`,
          [req.params.id, plan.record.leave_type, plan.record.leave_session, plan.record.reason, req.auth.userId, currentStudent.status]
        );
        return { student: updated.rows[0], leave: leave.rows[0] };
      });

      if (!saved) {
        throw Errors.conflict(
          'CONFLICT_VERSION_MISMATCH',
          'This record changed before the leave could be saved. Refresh and try again.'
        );
      }

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STUDENT_LEAVE_RECORDED',
        entityType: 'student',
        entityId: req.params.id,
        result: 'success',
        metadata: {
          leaveType: plan.record.leave_type,
          session: plan.record.leave_session,
          previousStatus: currentStudent.status,
        },
      });

      return res.json(saved);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /students/:id/entrance-outcome
 * Records the common entrance outcome for a Primary 5 pupil. Entered by hand.
 * Only the Principal and Director may record it. The outcome gates promotion
 * to JSS1 (see planPromotion).
 */
router.post(
  '/:id/entrance-outcome',
  requireAuth,
  requireRole('principal', 'director'),
  [
    param('id').isUUID(),
    body('outcome').isIn(['admitted', 'not_admitted']),
    body('basedOnVersion').isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const currentStudent = await getCurrentServerState(req.params.id);
      if (!currentStudent) {
        throw Errors.notFound('That student could not be found.');
      }

      if (currentStudent.class_level !== 'Primary 5') {
        throw Errors.badRequest(
          'NOT_PRIMARY_5',
          'An entrance outcome can only be recorded for a Primary 5 pupil.'
        );
      }

      const scope = await getScopeForUser(req.auth);
      if (
        !isWithinScope(scope, {
          division: currentStudent.division,
          classLevel: currentStudent.class_level,
          arm: currentStudent.arm,
        })
      ) {
        throw Errors.forbidden('You do not have permission to update this student.');
      }

      const { rows } = await db.query(
        `UPDATE students
            SET entrance_outcome = $3,
                sync_version = sync_version + 1,
                updated_at = now()
          WHERE id = $1 AND sync_version = $2 AND class_level = 'Primary 5'
          RETURNING *`,
        [req.params.id, req.body.basedOnVersion, req.body.outcome]
      );

      if (rows.length === 0) {
        throw Errors.conflict(
          'CONFLICT_VERSION_MISMATCH',
          'This record changed before the result could be saved. Refresh and try again.'
        );
      }

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STUDENT_ENTRANCE_OUTCOME_RECORDED',
        entityType: 'student',
        entityId: req.params.id,
        result: 'success',
        metadata: {
          outcome: req.body.outcome,
          previous: currentStudent.entrance_outcome || null,
        },
      });

      return res.json({ student: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /students/:id/photo
 * Returns a signed link to the student's current photo. Only staff whose scope
 * covers the student get a link. Student photos are private, so this is the
 * only way to view one.
 */
router.get(
  '/:id/photo',
  requireAuth,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
      }

      const currentStudent = await getCurrentServerState(req.params.id);
      if (!currentStudent) {
        throw Errors.notFound('That student could not be found.');
      }

      const scope = await getScopeForUser(req.auth);
      if (
        !isWithinScope(scope, {
          division: currentStudent.division,
          classLevel: currentStudent.class_level,
          arm: currentStudent.arm,
        })
      ) {
        throw Errors.forbidden('You do not have permission to view this student\'s photo.');
      }

      const { rows } = await db.query(
        `SELECT cloudinary_public_id, storage_url
           FROM student_photos
          WHERE student_id = $1 AND is_current = TRUE
          LIMIT 1`,
        [req.params.id]
      );
      const photo = rows[0];
      if (!photo) {
        return res.json({ url: null });
      }

      // Old rows keep their public link until they are moved to private storage.
      const url = photo.cloudinary_public_id
        ? signedStudentPhotoUrl(photo.cloudinary_public_id)
        : photo.storage_url;

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STUDENT_PHOTO_VIEWED',
        entityType: 'student',
        entityId: req.params.id,
        result: 'success',
      });

      return res.json({ url });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /students/:id/photo
 */
router.post(
  '/:id/photo',
  requireAuth,
  [
    param('id').isUUID(),
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

      // Security fix: photo upload never checked the student existed or
      // was in scope at all; any authenticated staff member could upload
      // a photo for any student ID, in or out of their division.
      const currentStudent =
        await getCurrentServerState(
          req.params.id
        );

      if (!currentStudent) {
        throw Errors.notFound(
          'That student could not be found.'
        );
      }

      const scope = await getScopeForUser(req.auth);

      if (
        !isWithinScope(scope, {
          division: currentStudent.division,
          classLevel: currentStudent.class_level,
          arm: currentStudent.arm,
        })
      ) {
        throw Errors.forbidden(
          'You do not have permission to update this student\'s photo.'
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

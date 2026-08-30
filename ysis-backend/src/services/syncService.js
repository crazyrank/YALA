const db = require('../db');
const {
  applyConditionalUpdate,
  getCurrentServerState,
} = require('./studentService');
const { uploadStudentPhoto } = require('./photoService');
const { userHasPermission } = require('./permissionService');
const { isAtMaxClass } = require('../utils/classProgression');

async function processOperation({
  operation,
  userId,
  userRole,
  deviceId,
}) {
  const {
    operationId,
    opType,
    entityId,
    payload,
    sequenceNo,
    createdAtClient,
  } = operation;

  const existing = await db.query(
    'SELECT id, status FROM sync_operations WHERE operation_id = $1',
    [operationId]
  );

  if (existing.rows.length > 0) {
    return {
      operationId,
      status: existing.rows[0].status,
      alreadyProcessed: true,
    };
  }

  const insertResult = await db.query(
    `INSERT INTO sync_operations
       (operation_id, op_type, entity_id, payload, user_id, device_id,
        sequence_no, created_at_client, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING id`,
    [
      operationId,
      opType,
      entityId,
      JSON.stringify(payload),
      userId,
      deviceId,
      sequenceNo,
      createdAtClient,
    ]
  );

  const syncOpRowId = insertResult.rows[0].id;

  try {
    if (opType === 'edit_student' || opType === 'promote_student') {
      if (
        opType === 'promote_student' &&
        userRole !== 'principal' &&
        userRole !== 'director'
      ) {
        const allowed = await userHasPermission({
          userId,
          role: userRole,
          permissionCode: 'PROMOTE_STUDENT',
          atTime: new Date(createdAtClient),
        });

        if (!allowed) {
          await markOpStatus(
            syncOpRowId,
            'failed',
            'You do not have permission to promote students right now.'
          );
          return {
            operationId,
            status: 'failed',
            error: 'FORBIDDEN',
          };
        }
      }

      if (opType === 'promote_student') {
        const currentStudent = await getCurrentServerState(entityId);

        if (!currentStudent) {
          await markOpStatus(
            syncOpRowId,
            'failed',
            'That student could not be found.'
          );
          return {
            operationId,
            status: 'failed',
            error: 'NOT_FOUND',
          };
        }

        if (isAtMaxClass(currentStudent.class_level)) {
          await markOpStatus(
            syncOpRowId,
            'failed',
            'This student is already at SS3, the highest class. They should be graduated, not promoted.'
          );
          return {
            operationId,
            status: 'failed',
            error: 'ALREADY_AT_MAX_CLASS',
          };
        }
      }

      const {
        updated,
        student,
        noOp,
      } = await applyConditionalUpdate({
        studentId: entityId,
        basedOnVersion: payload.based_on_version,
        changes: payload.changes || {},
      });

      if (noOp) {
        await markOpStatus(syncOpRowId, 'synced');
        return {
          operationId,
          status: 'synced',
        };
      }

      if (!updated) {
        const serverState = await db.query(
          'SELECT * FROM students WHERE id = $1',
          [entityId]
        );

        await db.query(
          `INSERT INTO conflicts
             (sync_operation_id, student_id, conflict_summary, server_state, incoming_change)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            syncOpRowId,
            entityId,
            'This student\'s record changed before this update could be applied.',
            JSON.stringify(serverState.rows[0] || {}),
            JSON.stringify(payload),
          ]
        );

        await markOpStatus(syncOpRowId, 'conflicted');
        return {
          operationId,
          status: 'conflicted',
        };
      }

      await markOpStatus(syncOpRowId, 'synced');
      return {
        operationId,
        status: 'synced',
        student,
      };
    }

    if (opType === 'create_student') {
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
      } = payload || {};

      if (!id || !admissionNo || !fullName || !division || !classLevel) {
        await markOpStatus(
          syncOpRowId,
          'failed',
          'create_student payload is missing required fields.'
        );
        return {
          operationId,
          status: 'failed',
          error: 'VALIDATION_ERROR',
        };
      }

      try {
        await db.query(
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
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
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
            userId,
            deviceId,
          ]
        );

        await markOpStatus(syncOpRowId, 'synced');
        return {
          operationId,
          status: 'synced',
        };
      } catch (dbErr) {
        if (
          dbErr.code === '23505' &&
          (dbErr.constraint === 'students_admission_no_key' ||
            (dbErr.detail && String(dbErr.detail).includes('admission_no')))
        ) {
          const existing = await db.query(
            'SELECT id FROM students WHERE admission_no = $1',
            [admissionNo]
          );
          const existingId = existing.rows[0]?.id;

          if (existingId && existingId !== id) {
            await markOpStatus(
              syncOpRowId,
              'conflicted',
              'Admission number already in use by another student.'
            );
            return {
              operationId,
              status: 'conflicted',
              error: 'ADMISSION_NUMBER_COLLISION',
            };
          }

          await markOpStatus(syncOpRowId, 'synced');
          return {
            operationId,
            status: 'synced',
          };
        }

        if (dbErr.code === '23505') {
          await markOpStatus(
            syncOpRowId,
            'failed',
            dbErr.detail || dbErr.message || 'A unique database constraint was violated.'
          );
          return {
            operationId,
            status: 'failed',
            error: 'CREATE_STUDENT_DUPLICATE',
          };
        }

        await markOpStatus(syncOpRowId, 'failed', dbErr.message);
        return {
          operationId,
          status: 'failed',
          error: 'CREATE_STUDENT_FAILED',
        };
      }
    }

    if (opType === 'upload_photo') {
      try {
        await uploadStudentPhoto({
          studentId: entityId,
          uploaderId: userId,
          uploaderRole: userRole,
          deviceId,
          imageBase64: payload.imageBase64,
          correctionReason: payload.correctionReason,
        });

        await markOpStatus(syncOpRowId, 'synced');
        return {
          operationId,
          status: 'synced',
        };
      } catch (photoErr) {
        await markOpStatus(
          syncOpRowId,
          'failed',
          photoErr.message
        );
        return {
          operationId,
          status: 'failed',
          error: photoErr.code || 'PHOTO_UPLOAD_FAILED',
        };
      }
    }

    await markOpStatus(
      syncOpRowId,
      'failed',
      'Unknown operation type'
    );

    return {
      operationId,
      status: 'failed',
    };
  } catch (err) {
    await markOpStatus(
      syncOpRowId,
      'failed',
      err.message
    );
    return {
      operationId,
      status: 'failed',
      error: 'PROCESSING_ERROR',
    };
  }
}

async function markOpStatus(
  id,
  status,
  errorMessage = null
) {
  await db.query(
    `UPDATE sync_operations
     SET status = $2, processed_at = now(), error_message = $3
     WHERE id = $1`,
    [id, status, errorMessage]
  );
}

async function processBatch({
  operations,
  userId,
  userRole,
  deviceId,
  batchId,
}) {
  const sorted = [...operations].sort(
    (a, b) => a.sequenceNo - b.sequenceNo
  );

  const results = [];

  for (const op of sorted) {
    const result = await processOperation({
      operation: op,
      userId,
      userRole,
      deviceId,
    });

    results.push(result);

    if (batchId) {
      await db.query(
        'UPDATE sync_operations SET batch_id = $2 WHERE operation_id = $1',
        [op.operationId, batchId]
      );
    }
  }

  return results;
}

module.exports = {
  processOperation,
  processBatch,
};

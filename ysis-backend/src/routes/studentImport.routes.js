const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const {
  HEADER,
  MAX_ROWS,
  MAX_CELL_LENGTH,
  analyzeRecords,
} = require('../services/studentImportCore');

const router = express.Router();

function conflict(code, message) {
  const err = Errors.badRequest(code, message);
  err.statusCode = 409;
  return err;
}

const ADMIN_ROLES = ['principal', 'director'];
const ALLOWED_KEYS = new Set(HEADER);

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

/**
 * Checks the shape of every submitted row before any rule runs.
 * Error messages name rows and fields, never values.
 */
function validateSubmittedRows(rows) {
  const seen = new Set();
  return rows.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw Errors.badRequest('VALIDATION_ERROR', `Item ${index + 1} is not a valid row.`);
    }
    const { sourceRow, data } = item;
    if (!Number.isInteger(sourceRow) || sourceRow < 2 || sourceRow > 1000000) {
      throw Errors.badRequest('VALIDATION_ERROR', `Item ${index + 1} has an invalid source row number.`);
    }
    if (seen.has(sourceRow)) {
      throw Errors.badRequest('VALIDATION_ERROR', `Source row ${sourceRow} was sent more than once.`);
    }
    seen.add(sourceRow);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw Errors.badRequest('VALIDATION_ERROR', `Source row ${sourceRow} has no data.`);
    }

    const clean = {};
    for (const key of Object.keys(data)) {
      if (!ALLOWED_KEYS.has(key)) {
        throw Errors.badRequest('VALIDATION_ERROR', `Source row ${sourceRow} has an unexpected field.`);
      }
      const value = data[key];
      if (value === null || value === undefined) {
        clean[key] = '';
        continue;
      }
      if (typeof value !== 'string') {
        throw Errors.badRequest('VALIDATION_ERROR', `Source row ${sourceRow}, field "${key}", must be text.`);
      }
      if (value.length > MAX_CELL_LENGTH) {
        throw Errors.badRequest('VALIDATION_ERROR', `Source row ${sourceRow}, field "${key}", is too long.`);
      }
      clean[key] = value;
    }
    return { sourceRow, data: clean };
  });
}

function batchResponse(batch) {
  return {
    importKey: batch.import_key,
    status: batch.status,
    submittedRows: batch.submitted_rows,
    imported: batch.imported_count,
    skipped: batch.skipped_count,
    report: batch.report || [],
    errorCode: batch.error_code || null,
    completedAt: batch.completed_at || null,
  };
}

/**
 * POST /students/import
 * Principal and Director only. Re-runs every rule on the server, so the phone's
 * preview is never trusted. Valid rows are inserted in ONE transaction.
 * Sending the same importKey again returns the stored result, with no duplicates.
 */
router.post(
  '/',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  [
    body('importKey').isUUID(),
    body('rows').isArray({ min: 1, max: MAX_ROWS }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const { importKey, rows } = req.body;
      const records = validateSubmittedRows(rows);

      // Idempotency: a repeated key returns what happened the first time.
      const found = await db.query(
        `SELECT * FROM student_import_batches WHERE import_key = $1`,
        [importKey]
      );
      if (found.rows.length > 0) {
        const batch = found.rows[0];
        if (batch.uploaded_by !== req.auth.userId) {
          throw Errors.notFound('That import could not be found.');
        }
        if (batch.status === 'processing') {
          throw conflict('IMPORT_IN_PROGRESS', 'This import is already being processed.');
        }
        if (batch.status === 'failed') {
          throw conflict('IMPORT_FAILED', 'This import did not complete. Nothing was saved. Start the import again.');
        }
        return res.status(200).json(batchResponse(batch));
      }

      let batchId;
      try {
        const created = await db.query(
          `INSERT INTO student_import_batches (import_key, uploaded_by, status, submitted_rows)
           VALUES ($1, $2, 'processing', $3)
           RETURNING id`,
          [importKey, req.auth.userId, records.length]
        );
        batchId = created.rows[0].id;
      } catch (err) {
        if (err.code === '23505') {
          throw conflict('IMPORT_IN_PROGRESS', 'This import is already being processed.');
        }
        throw err;
      }

      const { valid, rejected } = analyzeRecords(records);

      // Skip admission numbers that already exist. Existing records are never changed.
      const keys = [...new Set(valid.map((v) => v.value.admissionNo.toLowerCase()))];
      const existing = new Set();
      if (keys.length > 0) {
        const taken = await db.query(
          'SELECT lower(admission_no) AS k FROM students WHERE lower(admission_no) = ANY($1::text[])',
          [keys]
        );
        for (const r of taken.rows) existing.add(r.k);
      }

      const toInsert = [];
      for (const item of valid) {
        if (existing.has(item.value.admissionNo.toLowerCase())) {
          rejected.push({ row: item.sourceRow, column: 'admission_no', reason: 'already exists in the database (not changed)' });
        } else {
          toInsert.push(item);
        }
      }
      rejected.sort((a, b) => a.row - b.row);

      try {
        await db.withTransaction(async (client) => {
          for (const item of toInsert) {
            const v = item.value;
            await client.query(
              `INSERT INTO students
                 (id, admission_no, full_name, division, class_level, arm, gender,
                  guardian_name, guardian_phone, registered_by, registered_device_id)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                v.admissionNo,
                v.fullName,
                v.division,
                v.classLevel,
                v.arm,
                v.gender,
                v.guardianName,
                v.guardianPhone,
                req.auth.userId,
                req.auth.deviceId,
              ]
            );
          }
        });
      } catch (err) {
        await db.query(
          `UPDATE student_import_batches
              SET status = 'failed', error_code = $2, completed_at = now()
            WHERE id = $1`,
          [batchId, err.code === '23505' ? 'ADMISSION_NUMBER_TAKEN' : 'INSERT_FAILED']
        );
        if (err.code === '23505') {
          throw conflict(
            'ADMISSION_NUMBER_TAKEN',
            'An admission number was saved by someone else during this import. Nothing was imported. Start the import again.'
          );
        }
        throw err;
      }

      const report = rejected.map(({ row, column, reason }) => ({ row, column, reason }));

      const done = await db.query(
        `UPDATE student_import_batches
            SET status = 'completed',
                imported_count = $2,
                skipped_count = $3,
                report = $4::jsonb,
                completed_at = now()
          WHERE id = $1
        RETURNING *`,
        [batchId, toInsert.length, report.length, JSON.stringify(report)]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'STUDENTS_BULK_IMPORTED',
        entityType: 'student_import',
        entityId: batchId,
        result: 'success',
        metadata: { submitted: records.length, imported: toInsert.length, skipped: report.length },
      });

      return res.status(201).json(batchResponse(done.rows[0]));
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /students/import/:importKey
 * Re-fetches a stored result. Only the admin who ran the import can see it.
 */
router.get(
  '/:importKey',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  [param('importKey').isUUID()],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { rows } = await db.query(
        `SELECT * FROM student_import_batches
          WHERE import_key = $1 AND uploaded_by = $2`,
        [req.params.importKey, req.auth.userId]
      );
      if (rows.length === 0) {
        throw Errors.notFound('That import could not be found.');
      }
      return res.json(batchResponse(rows[0]));
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { triggerSync } from './syncEngine';

// NO_RESULT: the server may already have saved the record, so the same
// operationId is sent again and the server answers with the saved result.
const SAME_ID_CODES = ['NO_RESULT'];

// PROCESSING_ERROR: the server recorded a failure. Sending the same ID would
// return that old failure, so a fresh ID is used for the retry.
const NEW_ID_CODES = ['PROCESSING_ERROR', 'PHOTO_UPLOAD_FAILED'];

const FRIENDLY_MESSAGES = {
  NOT_FOUND: 'This student is no longer on the server, so this change cannot be saved.',
  FORBIDDEN: 'You do not have permission to make this change.',
  NO_RESULT: 'The server did not finish this change.',
  PROCESSING_ERROR: 'The server could not process this change.',
  PHOTO_UPLOAD_FAILED: 'The photo could not be uploaded.',
  CREATE_STUDENT_FAILED: 'This record could not be saved to the server.',
  REQUEST_FAILED: 'The request to the server failed.',
  ADMISSION_NUMBER_COLLISION: 'Another student already has this admission number.',
};

function describeFailure(code, message) {
  if (message && message !== code) return message;
  return FRIENDLY_MESSAGES[code] || 'This change could not be saved.';
}

/**
 * Read-only. Lists operations parked on this device, with the reason for
 * each, and whether a retry is safe without a human looking at it first.
 * Identical failures for the same student and action are shown once.
 */
export async function getParkedOperations() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT so.operation_id, so.op_type, so.entity_id, so.status,
            so.error_code, so.error_message, so.last_attempt_at,
            s.full_name, s.admission_no
     FROM sync_operations so
     LEFT JOIN students s ON s.id = so.entity_id
     WHERE so.status IN ('failed', 'conflicted')
     ORDER BY so.last_attempt_at DESC`
  );

  const groups = new Map();
  for (const r of rows) {
    const key = `${r.op_type}|${r.entity_id}|${r.error_code || ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.operation_ids.push(r.operation_id);
      existing.duplicates += 1;
    } else {
      groups.set(key, {
        ...r,
        operation_ids: [r.operation_id],
        duplicates: 1,
        reason: describeFailure(r.error_code, r.error_message),
        retryable: SAME_ID_CODES.includes(r.error_code) || NEW_ID_CODES.includes(r.error_code),
      });
    }
  }
  return Array.from(groups.values());
}

/**
 * Removes parked changes the person chose to give up on. Only rows that are
 * already failed or conflicted can be removed.
 */
export async function discardParkedOperations(operationIds) {
  if (!Array.isArray(operationIds) || operationIds.length === 0) return 0;
  const db = await getDb();
  const marks = operationIds.map(() => '?').join(', ');
  const res = await db.runAsync(
    `DELETE FROM sync_operations
     WHERE operation_id IN (${marks}) AND status IN ('failed', 'conflicted')`,
    operationIds
  );
  triggerSync();
  return res?.changes || 0;
}

/**
 * Removes every parked change whose student no longer exists on the server.
 * These can never succeed.
 */
export async function discardMissingRecordOperations() {
  const db = await getDb();
  const res = await db.runAsync(
    `DELETE FROM sync_operations
     WHERE status IN ('failed', 'conflicted') AND error_code = 'NOT_FOUND'`
  );
  triggerSync();
  return res?.changes || 0;
}

/**
 * Requeues only failures that can succeed on a second try without any change
 * to the record. Anything else (duplicate admission number, validation,
 * forbidden) stays parked for a person to fix. Returns the number requeued.
 */
export async function requeueTransientFailures() {
  const db = await getDb();
  let count = 0;

  const sameIdRows = await db.getAllAsync(
    `SELECT operation_id FROM sync_operations
     WHERE status = 'failed' AND error_code IN (${SAME_ID_CODES.map(() => '?').join(', ')})`,
    SAME_ID_CODES
  );
  for (const row of sameIdRows) {
    await db.runAsync(
      `UPDATE sync_operations
       SET status = 'pending', attempts = 0, error_code = NULL, error_message = NULL
       WHERE operation_id = ?`,
      [row.operation_id]
    );
    count += 1;
  }

  const newIdRows = await db.getAllAsync(
    `SELECT operation_id FROM sync_operations
     WHERE status = 'failed' AND error_code IN (${NEW_ID_CODES.map(() => '?').join(', ')})`,
    NEW_ID_CODES
  );
  for (const row of newIdRows) {
    await db.runAsync(
      `UPDATE sync_operations
       SET operation_id = ?, status = 'pending', attempts = 0,
           error_code = NULL, error_message = NULL
       WHERE operation_id = ?`,
      [uuidv4(), row.operation_id]
    );
    count += 1;
  }

  if (count > 0) triggerSync();
  return count;
}

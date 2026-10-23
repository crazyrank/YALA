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

/**
 * Read-only. Lists operations parked on this device, with the reason for
 * each, and whether a retry is safe without a human looking at it first.
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
  return rows.map((r) => ({
    ...r,
    retryable: SAME_ID_CODES.includes(r.error_code) || NEW_ID_CODES.includes(r.error_code),
  }));
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

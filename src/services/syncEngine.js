import NetInfo from '@react-native-community/netinfo';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getNextSequenceNo } from '../db';
import { api } from '../api/client';
import { SYNC_BATCH_SIZE } from '../config';

// Keep each request well under the backend body limit (2mb).
const MAX_BATCH_BYTES = 700 * 1024;
// After this many failed tries an operation is parked as failed,
// so one bad record can never block the rest of the queue.
const MAX_ATTEMPTS = 5;
const CANDIDATE_LIMIT = 200;

let syncInFlight = false;
let attemptsColumnReady = null;
const listeners = new Set();

export function onSyncStatusChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(status) {
  listeners.forEach((fn) => fn(status));
}

// Adds the attempts counter to existing installs. Safe to run repeatedly.
function ensureAttemptsColumn(db) {
  if (!attemptsColumnReady) {
    attemptsColumnReady = (async () => {
      const cols = await db.getAllAsync('PRAGMA table_info(sync_operations)');
      if (!cols.some((c) => c.name === 'attempts')) {
        await db.execAsync(
          'ALTER TABLE sync_operations ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0'
        );
      }
    })();
  }
  return attemptsColumnReady;
}

export async function queueOperation({ opType, entityId, payload }) {
  const db = await getDb();
  const sequenceNo = await getNextSequenceNo();
  const operationId = uuidv4();
  const createdAtClient = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_operations
       (id, operation_id, op_type, entity_id, payload, sequence_no, created_at_client, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [uuidv4(), operationId, opType, entityId, JSON.stringify(payload), sequenceNo, createdAtClient]
  );

  triggerSync();
  return operationId;
}

// Picks the next group of pending rows to send. Photos travel alone because
// they are large. Order is kept, so no operation is skipped.
function buildBatch(rows) {
  const batch = [];
  let bytes = 0;
  for (const row of rows) {
    if (row.op_type === 'upload_photo') {
      if (batch.length === 0) return [row];
      break;
    }
    if (batch.length >= SYNC_BATCH_SIZE) break;
    const size = String(row.payload || '').length;
    if (batch.length > 0 && bytes + size > MAX_BATCH_BYTES) break;
    batch.push(row);
    bytes += size;
  }
  return batch;
}

function toOperation(row) {
  return {
    operationId: row.operation_id,
    opType: row.op_type,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload),
    sequenceNo: row.sequence_no,
    createdAtClient: row.created_at_client,
  };
}

function attentionItem(row, status, errorCode) {
  return {
    operationId: row.operation_id,
    entityId: row.entity_id,
    opType: row.op_type,
    status,
    errorCode: errorCode || null,
  };
}

// Records one failed try. Returns { status, code } once the operation has
// been parked as failed, otherwise null (it stays pending and will retry).
async function countFailedAttempt(db, operationId, code, message) {
  await db.runAsync(
    'UPDATE sync_operations SET attempts = attempts + 1, last_attempt_at = ? WHERE operation_id = ?',
    [new Date().toISOString(), operationId]
  );
  const row = await db.getFirstAsync(
    'SELECT attempts FROM sync_operations WHERE operation_id = ?',
    [operationId]
  );
  const tries = Number(row?.attempts || 0);
  if (tries < MAX_ATTEMPTS) return null;

  await db.runAsync(
    "UPDATE sync_operations SET status = 'failed', error_code = ?, error_message = ? WHERE operation_id = ?",
    [code, `${message} Gave up after ${tries} tries.`, operationId]
  );
  return { status: 'failed', code };
}

async function clearLocalDirtyFlag(db, entityId) {
  await db.runAsync('UPDATE students SET local_dirty = 0 WHERE id = ?', [entityId]);
}

// Sends one batch and applies every result. Throws only on request failures.
async function sendBatch(db, batch) {
  const operations = batch.map(toOperation);
  const response = await api.post('/sync', { operations });
  const byId = new Map((response?.results || []).map((r) => [r.operationId, r]));
  const attention = [];
  const now = new Date().toISOString();

  for (const row of batch) {
    const result = byId.get(row.operation_id);

    // No usable answer for this operation: count it as a failed try.
    if (!result || result.status === 'pending') {
      const given = await countFailedAttempt(
        db,
        row.operation_id,
        'NO_RESULT',
        'The server did not finish this operation.'
      );
      if (given) attention.push(attentionItem(row, given.status, given.code));
      continue;
    }

    await db.runAsync(
      `UPDATE sync_operations
       SET status = ?, last_attempt_at = ?, error_code = ?, error_message = ?
       WHERE operation_id = ?`,
      [
        result.status,
        now,
        result.error || null,
        result.message || result.error || null,
        row.operation_id,
      ]
    );

    if (result.status === 'synced') {
      await clearLocalDirtyFlag(db, row.entity_id);
    } else if (result.status === 'failed' || result.status === 'conflicted') {
      attention.push(attentionItem(row, result.status, result.error));
    }
  }

  return attention;
}

// If a batch is rejected for a reason other than the network, retry each
// operation on its own so the bad one is isolated and the rest still sync.
async function sendWithIsolation(db, batch) {
  try {
    return await sendBatch(db, batch);
  } catch (err) {
    if (err.isNetworkError) throw err;

    if (batch.length > 1) {
      const attention = [];
      for (const row of batch) {
        attention.push(...(await sendWithIsolation(db, [row])));
      }
      return attention;
    }

    const row = batch[0];
    const given = await countFailedAttempt(
      db,
      row.operation_id,
      err.code || 'REQUEST_FAILED',
      err.message || 'The server could not process this operation.'
    );
    return given ? [attentionItem(row, given.status, given.code)] : [];
  }
}

export async function triggerSync() {
  if (syncInFlight) return;

  const netState = await NetInfo.fetch();
  const explicitlyOffline =
    netState.isConnected === false || netState.isInternetReachable === false;
  if (explicitlyOffline) {
    notify({ state: 'offline' });
    return;
  }

  syncInFlight = true;
  notify({ state: 'syncing' });

  try {
    const db = await getDb();
    await ensureAttemptsColumn(db);

    const attention = [];
    let processedCount = 0;

    // Each pass either finishes operations or adds a failed try to them,
    // so the loop always ends.
    while (true) {
      const candidates = await db.getAllAsync(
        `SELECT * FROM sync_operations
         WHERE status = 'pending'
         ORDER BY sequence_no ASC
         LIMIT ?`,
        [CANDIDATE_LIMIT]
      );
      if (candidates.length === 0) break;

      const batch = buildBatch(candidates);
      attention.push(...(await sendWithIsolation(db, batch)));
      processedCount += batch.length;
    }

    if (attention.length > 0) {
      notify({ state: 'attention_needed', items: attention });
    }
    notify({ state: 'idle', processedCount });
  } catch (err) {
    notify({ state: 'error', error: err.message });
  } finally {
    syncInFlight = false;
  }
}

/**
 * Records that will NOT sync on their own and need a human to look at
 * them, e.g. a create_student rejected for a duplicate admission number.
 */
export async function getSyncFailures() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT so.operation_id, so.op_type, so.entity_id, so.status,
            so.error_code, so.error_message, so.payload,
            s.full_name, s.admission_no
     FROM sync_operations so
     LEFT JOIN students s ON s.id = so.entity_id
     WHERE so.status IN ('failed', 'conflicted')
     ORDER BY so.last_attempt_at DESC`
  );
  return rows.map((r) => ({
    ...r,
    payload: JSON.parse(r.payload),
  }));
}

/**
 * Use when an operation was rejected and the user has corrected the record
 * locally. Retires the dead operation and queues a fresh one.
 */
export async function retryFailedOperation(operationId, correctedPayload) {
  const db = await getDb();
  const old = await db.getFirstAsync(
    'SELECT * FROM sync_operations WHERE operation_id = ?',
    [operationId]
  );
  if (!old) return null;

  await db.runAsync('DELETE FROM sync_operations WHERE operation_id = ?', [operationId]);

  return queueOperation({
    opType: old.op_type,
    entityId: old.entity_id,
    payload: correctedPayload,
  });
}

export async function hasPendingChanges() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM sync_operations WHERE status = 'pending'`
  );
  return row.count > 0;
}

export function startAutoSyncListener() {
  let wasOffline = false;

  const unsubscribe = NetInfo.addEventListener((state) => {
    const explicitlyOffline =
      state.isConnected === false || state.isInternetReachable === false;

    if (explicitlyOffline) {
      wasOffline = true;
      return;
    }

    if (wasOffline) {
      wasOffline = false;
      triggerSync();
    }
  });

  return { remove: unsubscribe };
}

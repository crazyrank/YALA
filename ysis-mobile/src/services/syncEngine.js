import NetInfo from '@react-native-community/netinfo';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getNextSequenceNo } from '../db';
import { api } from '../api/client';
import { SYNC_BATCH_SIZE } from '../config';

let syncInFlight = false;
const listeners = new Set();

export function onSyncStatusChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(status) {
  listeners.forEach((fn) => fn(status));
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
    const pending = await db.getAllAsync(
      `SELECT * FROM sync_operations WHERE status = 'pending' ORDER BY sequence_no ASC LIMIT ?`,
      [SYNC_BATCH_SIZE]
    );

    if (pending.length === 0) {
      notify({ state: 'idle' });
      return;
    }

    const operations = pending.map((row) => ({
      operationId: row.operation_id,
      opType: row.op_type,
      entityId: row.entity_id,
      payload: JSON.parse(row.payload),
      sequenceNo: row.sequence_no,
      createdAtClient: row.created_at_client,
    }));

    const response = await api.post('/sync', { operations });

    const attentionNeeded = [];

    for (const result of response.results) {
      await db.runAsync(
        `UPDATE sync_operations
         SET status = ?, last_attempt_at = ?, error_code = ?, error_message = ?
         WHERE operation_id = ?`,
        [
          result.status,
          new Date().toISOString(),
          result.error || null,
          result.message || result.error || null,
          result.operationId,
        ]
      );

      if (result.status === 'synced') {
        await clearLocalDirtyFlag(result.operationId);
      } else if (result.status === 'failed' || result.status === 'conflicted') {
        // These are NOT network errors -- the request succeeded, the server
        // just rejected this specific record (e.g. duplicate admission
        // number). Previously this was written to the DB and never
        // surfaced anywhere, so records could sit unsynced forever with
        // no visible explanation. Collect them so the UI can show why.
        const op = pending.find((p) => p.operation_id === result.operationId);
        attentionNeeded.push({
          operationId: result.operationId,
          entityId: op?.entity_id,
          opType: op?.op_type,
          status: result.status,
          errorCode: result.error || null,
        });
      }
    }

    if (attentionNeeded.length > 0) {
      notify({ state: 'attention_needed', items: attentionNeeded });
    }

    notify({ state: 'idle', processedCount: response.results.length });

    const remaining = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM sync_operations WHERE status = 'pending'`
    );
    if (remaining.count > 0) {
      syncInFlight = false;
      return triggerSync();
    }
  } catch (err) {
    notify({ state: 'error', error: err.message });
  } finally {
    syncInFlight = false;
  }
}

async function clearLocalDirtyFlag(operationId) {
  const db = await getDb();
  const op = await db.getFirstAsync(
    'SELECT entity_id FROM sync_operations WHERE operation_id = ?',
    [operationId]
  );
  if (op) {
    await db.runAsync(
      'UPDATE students SET local_dirty = 0 WHERE id = ?',
      [op.entity_id]
    );
  }
}

/**
 * Records that will NOT sync on their own and need a human to look at
 * them -- e.g. a create_student rejected for a duplicate admission
 * number. Distinct from 'pending', which just means "hasn't tried yet
 * or waiting on connectivity" and will resolve itself.
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
 * Use when a create_student op was rejected (e.g. duplicate admission
 * number) and the user has corrected the record locally. Retires the
 * dead operation and queues a fresh one so it isn't stuck referencing
 * the old failed attempt forever.
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
    const isOnline = !explicitlyOffline;

    if (!isOnline) {
      wasOffline = true;
      return;
    }

    if (isOnline && wasOffline) {
      wasOffline = false;
      triggerSync();
    }
  });

  return { remove: unsubscribe };
}

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

    for (const result of response.results) {
      await db.runAsync(
        `UPDATE sync_operations SET status = ?, last_attempt_at = ? WHERE operation_id = ?`,
        [result.status, new Date().toISOString(), result.operationId]
      );

      if (result.status === 'synced') {
        await clearLocalDirtyFlag(result.operationId);
      }
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
  const op = await db.getFirstAsync('SELECT entity_id FROM sync_operations WHERE operation_id = ?', [operationId]);
  if (op) {
    await db.runAsync('UPDATE students SET local_dirty = 0 WHERE id = ?', [op.entity_id]);
  }
}

export async function hasPendingChanges() {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT COUNT(*) as count FROM sync_operations WHERE status = 'pending'`);
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

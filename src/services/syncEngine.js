import * as Network from 'expo-network';
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

/**
 * Queues a local operation. This is the "local commit first" boundary
 * (Principle 2): the caller (a screen) should update the local `students`
 * table AND call this in the same local transaction, so the save
 * completes instantly regardless of network state. This function itself
 * never blocks on the network.
 */
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

  // Fire-and-forget attempt — if offline, this just fails silently and
  // the operation sits in the queue until the next explicit sync trigger
  // (app foreground, pull-to-refresh, or network-reconnect listener).
  triggerSync();

  return operationId;
}

/**
 * Attempts to flush the pending queue to the server, in FIFO order
 * (sequence_no ascending — Principle 3/11). Safe to call repeatedly;
 * guards against overlapping runs.
 */
export async function triggerSync() {
  if (syncInFlight) return;

  const netState = await Network.getNetworkStateAsync();
  if (!netState.isConnected || !netState.isInternetReachable) {
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
      // eslint-disable-next-line no-await-in-loop
      await db.runAsync(
        `UPDATE sync_operations SET status = ?, last_attempt_at = ? WHERE operation_id = ?`,
        [result.status, new Date().toISOString(), result.operationId]
      );

      if (result.status === 'synced') {
        // eslint-disable-next-line no-await-in-loop
        await clearLocalDirtyFlag(result.operationId);
      }
      // 'conflicted' operations are left as-is locally — the server's
      // `conflicts` table is the record of truth for those; the Principal
      // resolves them server-side, and this device picks up the resolved
      // state on its next regular student-record refresh.
    }

    notify({ state: 'idle', processedCount: response.results.length });

    // More pending than one batch? Keep going.
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

/** True if there's anything sitting unsynced — drives the passive marquee only, never a live count. */
export async function hasPendingChanges() {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT COUNT(*) as count FROM sync_operations WHERE status = 'pending'`);
  return row.count > 0;
}

/** Start listening for connectivity changes and auto-trigger sync on reconnect. */
export function startAutoSyncListener() {
  if (typeof Network.addNetworkStateListener !== 'function') {
    // Not available on this expo-network version/platform. Sync still runs
    // on app launch and after every queueOperation call, so this only
    // disables the "auto-resync the instant wifi comes back" behavior.
    console.warn(
      'Network.addNetworkStateListener unavailable — skipping live reconnect listener.'
    );
    return { remove: () => {} };
  }

  return Network.addNetworkStateListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      triggerSync();
    }
  });
}

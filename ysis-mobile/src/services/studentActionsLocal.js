/**
 * Student actions on the phone (leave, entrance outcome, inactive / clear inactive).
 * Each one updates the local record and queues one sync operation. The server
 * checks the rules and the record version again when the phone syncs.
 */
import { getDb } from '../db';
import { queueOperation } from './syncEngine';

const LEAVE_TYPES = ['graduated', 'transferred', 'withdrawn', 'expelled', 'deceased', 'not_admitted'];
const LEAVABLE = ['registered', 'active', 'promoted', 'inactive'];

async function studentRow(db, studentId) {
  const row = await db.getFirstAsync('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!row) throw new Error('That student could not be found.');
  return row;
}

async function markLocal(db, studentId, fields) {
  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(', ');
  await db.runAsync(
    `UPDATE students SET ${sets}, local_dirty = 1, updated_at = ? WHERE id = ?`,
    [...Object.values(fields), new Date().toISOString(), studentId]
  );
}

export async function queueStudentLeave({ studentId, leaveType, reason, basedOnVersion }) {
  const db = await getDb();
  const s = await studentRow(db, studentId);
  if (!LEAVE_TYPES.includes(leaveType)) throw new Error('Choose a valid leave type.');
  if (!LEAVABLE.includes(s.status)) {
    throw new Error(`This student's status is ${s.status} and cannot be changed to a leave.`);
  }
  if (leaveType === 'graduated' && s.class_level !== 'SS3') {
    throw new Error('Only SS3 students can be recorded as Graduated.');
  }
  if (s.class_level === 'Primary 5' && !s.entrance_outcome && leaveType !== 'deceased') {
    throw new Error('This pupil has no recorded entrance result yet. Record it before recording a leave.');
  }
  await markLocal(db, studentId, { status: leaveType });
  await queueOperation({
    opType: 'student_leave',
    entityId: studentId,
    payload: { leaveType, reason, basedOnVersion },
  });
  return { ok: true, student: { status: leaveType, sync_version: basedOnVersion } };
}

export async function queueEntranceOutcome({ studentId, outcome, basedOnVersion }) {
  const db = await getDb();
  const s = await studentRow(db, studentId);
  if (s.class_level !== 'Primary 5') throw new Error('An entrance result can only be recorded for a Primary 5 pupil.');
  if (!['admitted', 'not_admitted'].includes(outcome)) throw new Error('Choose admitted or not admitted.');
  await markLocal(db, studentId, { entrance_outcome: outcome });
  await queueOperation({
    opType: 'entrance_outcome',
    entityId: studentId,
    payload: { outcome, basedOnVersion },
  });
  return { ok: true, student: { status: s.status, sync_version: basedOnVersion } };
}

/** path: 'inactive' | 'clear-inactive' (the same names the online screen used). */
export async function queueStatusChange({ studentId, path, body, basedOnVersion }) {
  if (path !== 'inactive' && path !== 'clear-inactive') {
    throw new Error('Undoing a leave needs an internet connection for now.');
  }
  const db = await getDb();
  const s = await studentRow(db, studentId);

  let action;
  let status;
  if (path === 'inactive') {
    if (s.status === 'inactive') throw new Error('This student is already marked Inactive.');
    if (!['registered', 'active', 'promoted'].includes(s.status)) {
      throw new Error(`This student's status is ${s.status} and cannot be marked Inactive.`);
    }
    const reason = ((body && body.reason) || '').trim();
    if (reason.length < 3 || reason.length > 300) throw new Error('Give a reason of 3 to 300 characters.');
    action = 'inactive';
    status = 'inactive';
    await markLocal(db, studentId, { status });
    await queueOperation({ opType: 'student_status_change', entityId: studentId, payload: { action, reason, basedOnVersion } });
  } else {
    if (s.status !== 'inactive') throw new Error('This student is not marked Inactive.');
    action = 'clear_inactive';
    status = 'active';
    await markLocal(db, studentId, { status });
    await queueOperation({ opType: 'student_status_change', entityId: studentId, payload: { action, basedOnVersion } });
  }
  return { ok: true, student: { status, sync_version: basedOnVersion } };
}

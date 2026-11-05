'use strict';
/**
 * Log book writes and the phone change feed. Shared rules come from logBookRules.js.
 * The phone sends the time it wrote or corrected an entry, so the 7-day and 24-hour
 * limits are judged from that time, not from when the phone finally syncs.
 */
const db = require('../db');
const { validateNewEntry, validateCorrection, EDIT_WINDOW_HOURS } = require('../utils/logBookRules');
const { getScopeForUser, scopeToSqlClause } = require('./studentScopeService');
const { writeAudit } = require('../middleware/audit');

const COLUMNS = `id, division, class_level, arm, to_char(entry_date, 'YYYY-MM-DD') AS entry_date,
  body, original_body, written_by, written_at, corrected_at, correction_count`;

function fail(code, message) {
  return { ok: false, code, message };
}

async function applyLogCreate({ entryId, auth, entryDate, body, clientTime }) {
  if (auth.role !== 'class_teacher') return fail('FORBIDDEN', 'Only a Class Teacher can write log entries.');

  const { rows: assignments } = await db.query(
    'SELECT division, class_level, arm FROM class_teacher_assignments WHERE user_id = $1',
    [auth.userId]
  );
  if (!assignments[0]) return fail('FORBIDDEN', 'You have no class assigned yet. Ask the Principal to assign one.');

  // "Today" is the school's date (Africa/Lagos) on the day the entry was written.
  const { rows: today } = await db.query(
    "SELECT to_char(($1::timestamptz AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS today",
    [clientTime]
  );
  const checked = validateNewEntry({ entryDate, body, today: today[0].today });
  if (!checked.ok) return fail(checked.code, checked.message);

  const a = assignments[0];
  const { rows } = await db.query(
    `INSERT INTO log_entries (id, division, class_level, arm, entry_date, body, written_by, written_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
     ON CONFLICT (id) DO NOTHING
     RETURNING ${COLUMNS}`,
    [entryId, a.division, a.class_level, a.arm, checked.value.entryDate, checked.value.body, auth.userId, clientTime]
  );
  // An entry that already exists means this is a retry of a write that worked.
  return { ok: true, row: rows[0] || null };
}

async function applyLogCorrection({ entryId, auth, body, clientTime }) {
  if (auth.role !== 'class_teacher') return fail('FORBIDDEN', 'Only a Class Teacher can correct log entries.');

  const { rows: found } = await db.query(
    `SELECT written_by, (($2::timestamptz - written_at) <= make_interval(hours => $3)) AS in_window
       FROM log_entries WHERE id = $1`,
    [entryId, clientTime, EDIT_WINDOW_HOURS]
  );
  const entry = found[0];
  if (!entry) return fail('NOT_FOUND', 'That entry could not be found.');
  if (entry.written_by !== auth.userId) return fail('FORBIDDEN', 'Only the person who wrote this entry can correct it.');
  if (!entry.in_window) {
    return fail('WINDOW_CLOSED', `Entries can be corrected only within ${EDIT_WINDOW_HOURS} hours of being written.`);
  }

  const checked = validateCorrection({ body });
  if (!checked.ok) return fail(checked.code, checked.message);

  const { rows } = await db.query(
    `UPDATE log_entries
        SET original_body = COALESCE(original_body, body), body = $2,
            corrected_at = $3::timestamptz, correction_count = correction_count + 1
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [entryId, checked.value.body, clientTime]
  );
  return { ok: true, row: rows[0] };
}

/** Phone change feed: staff in scope, last 30 school days, oldest change first. */
async function getLogChanges({ auth, since, afterId, limit }) {
  const scope = await getScopeForUser({ role: auth.role, userId: auth.userId });

  const params = [since, afterId];
  const conditions = [
    '(COALESCE(l.corrected_at, l.written_at), l.id) > ($1::timestamptz, $2::uuid)',
    "l.entry_date >= (now() AT TIME ZONE 'Africa/Lagos')::date - 30",
  ];
  let idx = 3;
  if (scope !== null) {
    const { clause, params: scopeParams } = scopeToSqlClause(scope, idx);
    conditions.push(`(${clause})`);
    params.push(...scopeParams);
    idx += scopeParams.length;
  }
  params.push(limit + 1);

  const { rows } = await db.query(
    `SELECT l.id, l.division, l.class_level, l.arm,
            to_char(l.entry_date, 'YYYY-MM-DD') AS entry_date,
            l.body, l.original_body, l.written_by, l.written_at, l.corrected_at, l.correction_count,
            COALESCE(l.corrected_at, l.written_at) AS changed_at,
            (SELECT u.full_name FROM users u WHERE u.id = l.written_by) AS written_by_name
       FROM log_entries l
      WHERE ${conditions.join(' AND ')}
      ORDER BY changed_at ASC, l.id ASC
      LIMIT $${idx}`,
    params
  );

  const hasMore = rows.length > limit;
  const page = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
    id: r.id,
    division: r.division,
    classLevel: r.class_level,
    arm: r.arm,
    entryDate: r.entry_date,
    body: r.body,
    originalBody: r.original_body,
    writtenBy: r.written_by,
    writtenByName: r.written_by_name,
    writtenAt: toIso(r.written_at),
    correctedAt: toIso(r.corrected_at),
    correctionCount: r.correction_count,
    changedAt: toIso(r.changed_at),
  }));
  return { rows: page, hasMore };
}

function toIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/** Runs one queued log book operation from /sync. */
async function handleLogBookOperation({ operation, userId, userRole, deviceId, syncOpRowId, markStatus }) {
  const auth = { userId, role: userRole, deviceId };
  const { operationId, opType, entityId, payload, createdAtClient } = operation;

  const result = opType === 'log_entry_create'
    ? await applyLogCreate({ entryId: entityId, auth, entryDate: payload.entryDate, body: payload.body, clientTime: createdAtClient })
    : await applyLogCorrection({ entryId: entityId, auth, body: payload.body, clientTime: createdAtClient });

  if (!result.ok) {
    await markStatus(syncOpRowId, 'failed', result.message);
    return { operationId, status: 'failed', error: result.code, message: result.message };
  }

  await markStatus(syncOpRowId, 'synced');
  await writeAudit({
    userId,
    deviceId,
    action: opType === 'log_entry_create' ? 'LOG_ENTRY_CREATED' : 'LOG_ENTRY_CORRECTED',
    entityType: 'log_entry',
    entityId,
    result: 'success',
    metadata: {},
  });
  return { operationId, status: 'synced' };
}

module.exports = { applyLogCreate, applyLogCorrection, getLogChanges, handleLogBookOperation };

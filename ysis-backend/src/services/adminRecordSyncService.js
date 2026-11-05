'use strict';

const db = require('../db');
const { validate: isUuid } = require('uuid');
const { writeAudit } = require('../middleware/audit');
const { getScopeForUser } = require('./studentScopeService');

const ADMIN_ROLES = ['principal', 'director', 'head_teacher'];
const STATUSES = ['contactable', 'opted_out', 'deceased'];
const DIVISIONS = ['primary', 'secondary'];
const MAX_TEXT = 500;
const MAX_BODY = 4000;

const ALUMNI_FIELD_COLUMNS = {
  fullName: 'full_name',
  division: 'division',
  graduationSession: 'graduation_session',
  lastClassLevel: 'last_class_level',
  phone: 'phone',
  email: 'email',
  address: 'address',
  notes: 'notes',
  contactStatus: 'contact_status',
};

function fail(code, message) {
  return { ok: false, code, message };
}

// null means unrestricted (Principal, Director). A Head Teacher gets their own divisions only.
async function divisionScope(userId, userRole) {
  if (userRole !== 'head_teacher') return null;
  const scope = await getScopeForUser({ role: userRole, userId });
  return [...new Set((scope || []).map((item) => item.division))];
}

function inScope(scope, division) {
  return scope === null || (Boolean(division) && scope.includes(division));
}

// Returns { ok, value } with trimmed text, or { ok: false, code, message }.
function cleanFields(raw) {
  const out = {};
  for (const key of Object.keys(ALUMNI_FIELD_COLUMNS)) {
    if (raw[key] === undefined) continue;
    const value = raw[key];
    if (value !== null && typeof value !== 'string') {
      return fail('VALIDATION_ERROR', `${key} must be text.`);
    }
    const trimmed = value === null ? '' : value.trim();
    if (trimmed.length > MAX_TEXT) {
      return fail('TOO_LONG', `Keep ${key} under ${MAX_TEXT} characters.`);
    }
    out[key] = trimmed || null;
  }
  if (out.fullName !== undefined && (!out.fullName || out.fullName.length < 2)) {
    return fail('VALIDATION_ERROR', 'Enter the full name.');
  }
  if (out.division !== undefined && !DIVISIONS.includes(out.division)) {
    return fail('VALIDATION_ERROR', 'Choose primary or secondary.');
  }
  if (out.contactStatus !== undefined && !STATUSES.includes(out.contactStatus)) {
    return fail('VALIDATION_ERROR', 'Choose a valid contact status.');
  }
  return { ok: true, value: out };
}

async function applyBlackBook({ operation, userId, userRole }) {
  if (userRole !== 'principal') {
    return fail('FORBIDDEN', 'Only the Principal can use the Black Book.');
  }
  const { entityId, payload } = operation;
  if (!isUuid(entityId)) return fail('VALIDATION_ERROR', 'The entry identifier is invalid.');

  const text = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!text) return fail('BODY_REQUIRED', 'Write the entry before saving.');
  if (text.length > MAX_BODY) {
    return fail('BODY_TOO_LONG', `Keep the entry under ${MAX_BODY} characters.`);
  }

  if (payload.action === 'create') {
    const { rows } = await db.query(
      `INSERT INTO black_book_entries (id, body, written_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [entityId, text, userId]
    );
    if (!rows[0]) {
      const { rows: existing } = await db.query(
        'SELECT written_by FROM black_book_entries WHERE id = $1',
        [entityId]
      );
      if (existing[0] && existing[0].written_by === userId) {
        return { ok: true, alreadyApplied: true };
      }
      return fail('ID_COLLISION', 'This entry identifier is already in use.');
    }
    return { ok: true, action: 'BLACK_BOOK_ENTRY_CREATED', metadata: {} };
  }

  if (payload.action === 'correct') {
    const { rows } = await db.query(
      `UPDATE black_book_entries
          SET original_body = COALESCE(original_body, body),
              body = $2,
              corrected_at = now(),
              correction_count = correction_count + 1
        WHERE id = $1
          AND written_by = $3
      RETURNING correction_count`,
      [entityId, text, userId]
    );
    if (!rows[0]) return fail('NOT_FOUND', 'That entry could not be found for correction.');
    return {
      ok: true,
      action: 'BLACK_BOOK_ENTRY_CORRECTED',
      metadata: { correctionCount: rows[0].correction_count },
    };
  }

  return fail('VALIDATION_ERROR', 'Choose a valid Black Book action.');
}

async function applyAlumni({ operation, userId, userRole }) {
  if (!ADMIN_ROLES.includes(userRole)) {
    return fail('FORBIDDEN', 'Only administrators can change alumni records.');
  }
  const { entityId, payload } = operation;
  if (!isUuid(entityId)) return fail('VALIDATION_ERROR', 'The record identifier is invalid.');

  const cleaned = cleanFields(payload.fields || {});
  if (!cleaned.ok) return cleaned;
  const v = cleaned.value;
  const scope = await divisionScope(userId, userRole);

  if (payload.action === 'create') {
    if (!v.fullName) return fail('VALIDATION_ERROR', 'Enter the full name.');
    if (!v.division) return fail('VALIDATION_ERROR', 'Choose primary or secondary.');
    if (!inScope(scope, v.division)) {
      return fail('FORBIDDEN', 'You can add alumni only in your own division.');
    }

    const { rows } = await db.query(
      `INSERT INTO alumni_records
         (id, full_name, division, graduation_session, last_class_level, phone, email,
          address, notes, contact_status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        entityId,
        v.fullName,
        v.division,
        v.graduationSession ?? null,
        v.lastClassLevel ?? null,
        v.phone ?? null,
        v.email ?? null,
        v.address ?? null,
        v.notes ?? null,
        v.contactStatus || 'contactable',
        userId,
      ]
    );
    if (!rows[0]) {
      const { rows: existing } = await db.query(
        'SELECT created_by FROM alumni_records WHERE id = $1',
        [entityId]
      );
      if (existing[0] && existing[0].created_by === userId) {
        return { ok: true, alreadyApplied: true };
      }
      return fail('ID_COLLISION', 'This record identifier is already in use.');
    }
    return { ok: true, action: 'ALUMNI_RECORD_CREATED', metadata: { division: v.division } };
  }

  if (payload.action === 'update') {
    const keys = Object.keys(v);
    if (keys.length === 0) return fail('VALIDATION_ERROR', 'Nothing to change.');

    const { rows: found } = await db.query(
      'SELECT id, division FROM alumni_records WHERE id = $1',
      [entityId]
    );
    if (!found[0]) return fail('NOT_FOUND', 'That alumni record could not be found.');
    if (!inScope(scope, found[0].division)) {
      return fail('FORBIDDEN', 'You can change alumni only in your own division.');
    }
    if (v.division !== undefined && !inScope(scope, v.division)) {
      return fail('FORBIDDEN', 'You can move alumni only into your own division.');
    }

    const params = [entityId];
    const sets = keys.map((key) => {
      params.push(v[key]);
      return `${ALUMNI_FIELD_COLUMNS[key]} = $${params.length}`;
    });
    params.push(userId);
    sets.push(`updated_by = $${params.length}`, 'updated_at = now()');

    await db.query(`UPDATE alumni_records SET ${sets.join(', ')} WHERE id = $1`, params);
    return { ok: true, action: 'ALUMNI_RECORD_UPDATED', metadata: { fieldsChanged: keys } };
  }

  return fail('VALIDATION_ERROR', 'Choose a valid alumni action.');
}

// Shared finish step: record the result, then write the audit row for successful changes.
async function finish({ result, operation, userId, deviceId, markStatus, syncOpRowId, opType }) {
  const { operationId, entityId } = operation;

  if (!result.ok) {
    await markStatus(syncOpRowId, 'failed', result.message);
    return { operationId, status: 'failed', error: result.code, message: result.message };
  }

  await markStatus(syncOpRowId, 'synced');
  if (result.action) {
    await writeAudit({
      userId,
      deviceId,
      action: result.action,
      entityType: opType === 'black_book_save' ? 'black_book_entry' : 'alumni_record',
      entityId,
      result: 'success',
      metadata: result.metadata || {},
    });
  }
  return { operationId, status: 'synced', alreadyApplied: !!result.alreadyApplied };
}

async function handleBlackBookOperation({ operation, userId, userRole, deviceId, syncOpRowId, markStatus }) {
  const result = await applyBlackBook({ operation, userId, userRole });
  return finish({ result, operation, userId, deviceId, markStatus, syncOpRowId, opType: 'black_book_save' });
}

async function handleAlumniOperation({ operation, userId, userRole, deviceId, syncOpRowId, markStatus }) {
  const result = await applyAlumni({ operation, userId, userRole });
  return finish({ result, operation, userId, deviceId, markStatus, syncOpRowId, opType: 'alumni_save' });
}

module.exports = { handleBlackBookOperation, handleAlumniOperation };

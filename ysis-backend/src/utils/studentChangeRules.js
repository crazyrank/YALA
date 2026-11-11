'use strict';

/**
 * Promotion and edit rules. Pure functions: they plan the change, the caller
 * writes it. Used by the REST promote route, the sync promote_student and
 * edit_student operations, and the PATCH route.
 */

const { getNextClass, isAtMaxClass, getPreviousClass } = require('./classProgression');
const { hasLeft } = require('./leaveRules');
const { normalizeStudent, cleanText, canonicalClass, divisionOfClass, armRuleFor } = require('./studentRules');
const { nextSession, previousSession, sessionIsAfter } = require('./academicSession');

// Database column -> API field name.
const DB_TO_API = {
  admission_no: 'admissionNo',
  full_name: 'fullName',
  division: 'division',
  class_level: 'classLevel',
  arm: 'arm',
  gender: 'gender',
  guardian_name: 'guardianName',
  guardian_phone: 'guardianPhone',
  date_of_birth: 'dateOfBirth',
  academic_session: 'academicSession',
  registered_term: 'registeredTerm',
};
const API_TO_DB = Object.fromEntries(Object.entries(DB_TO_API).map(([k, v]) => [v, k]));

// Profile fields a normal edit may change. Division and class are never edited
// directly; they change only through promotion.
const EDITABLE_API_FIELDS = ['admissionNo', 'fullName', 'arm', 'gender', 'dateOfBirth', 'guardianName', 'guardianPhone', 'academicSession', 'registeredTerm'];

// Status may be changed by edit only to these two values (archive and restore).
// Promotion sets 'promoted' through planPromotion, never through edit.
const STATUS_EDIT_VALUES = ['active', 'archived'];

/**
 * Plans a promotion. The next class is always the one the progression defines,
 * never a value the client chooses. Division follows the new class. Arm is
 * required when the new class needs one, and forbidden otherwise.
 * Current session is incremented by one year.
 *
 * Returns { ok, changes, code, message } where changes uses database column names.
 */
function planPromotion(currentRow, { newClassLevel, arm }) {
  if (isAtMaxClass(currentRow.class_level)) {
    return { ok: false, code: 'ALREADY_AT_MAX_CLASS', message: 'This student is already at SS3. They should be graduated, not promoted.' };
  }

  // A student who has left cannot be promoted.
  if (hasLeft(currentRow.status)) {
    return { ok: false, code: 'STUDENT_HAS_LEFT', message: 'This student has left the school and cannot be promoted.' };
  }

  // Primary 5 pupils move to JSS1 only if admitted. A missing outcome means
  // Result Pending. Both cases are refused here, so REST and sync share the rule.
  if (currentRow.class_level === 'Primary 5') {
    if (currentRow.entrance_outcome === 'not_admitted') {
      return { ok: false, code: 'NOT_ADMITTED', message: 'This pupil was not admitted to JSS1 and cannot be promoted.' };
    }
    if (currentRow.entrance_outcome !== 'admitted') {
      return { ok: false, code: 'RESULT_PENDING', message: 'This pupil has no recorded entrance result yet. The Principal or Director must record it first.' };
    }
  }

  const expected = getNextClass(currentRow.class_level);
  if (canonicalClass(newClassLevel) !== expected) {
    return { ok: false, code: 'INVALID_CLASS_PROGRESSION', message: `This student can only be promoted to ${expected}.` };
  }

  const rule = armRuleFor(expected);
  const armRaw = cleanText(arm);
  let nextArm = null;

  if (rule.required) {
    nextArm = rule.allowed.find((a) => a.toLowerCase() === armRaw.toLowerCase()) || null;
    if (!nextArm) {
      return { ok: false, code: 'ARM_REQUIRED', message: `Choose an arm (Science, Arts, or Commercial) for ${expected}.` };
    }
  } else if (armRaw) {
    return { ok: false, code: 'ARM_NOT_ALLOWED', message: `${expected} students do not have an arm.` };
  }

  // Validate the full resulting record with the shared rules before writing.
  const candidate = normalizeStudent({
    admissionNo: currentRow.admission_no,
    fullName: currentRow.full_name,
    division: divisionOfClass(expected),
    classLevel: expected,
    arm: nextArm,
    gender: currentRow.gender,
    guardianName: currentRow.guardian_name,
    guardianPhone: currentRow.guardian_phone,
  });
  if (!candidate.ok) {
    return { ok: false, code: 'RECORD_INVALID', message: `This record fails validation: ${candidate.errors[0]}` };
  }

  const changes = {
    class_level: expected,
    division: divisionOfClass(expected),
    arm: nextArm,
    status: 'promoted',
  };

  return {
    ok: true,
    changes,
  };
}

/**
 * Plans an undo of the last promotion. Reverses class and current_session.
 * Only allowed when current_session is strictly after the registered session
 * (or when current_session is set and we can compute a previous class).
 *
 * Returns { ok, changes, code, message }.
 */
function planUndoPromotion(currentRow) {
  // Undo is switched off until it can be limited safely without the session data.
  return { ok: false, code: 'UNDO_DISABLED', message: 'Undoing a promotion is not available right now. Ask the Principal or Director.' };
  const registered = currentRow.academic_session || null;
  const current = currentRow.current_session || registered;

  if (!sessionIsAfter(current, registered) && current === registered) {
    // No promotion has advanced the session yet.
    // Still allow class undo if they somehow have a previous class and status promoted,
    // but the primary guard is session.
  }

  const prevClass = getPreviousClass(currentRow.class_level);
  if (!prevClass) {
    return { ok: false, code: 'ALREADY_AT_MIN_CLASS', message: 'This student is already at the earliest class. Nothing to undo.' };
  }


  let prevSession = current ? previousSession(current) : null;
  // Never go below the registered session.
  if (registered && prevSession) {
    if (!sessionIsAfter(prevSession, registered) && prevSession !== registered) {
      prevSession = registered;
    }
  } else if (!prevSession && registered) {
    prevSession = registered;
  }

  const rule = armRuleFor(prevClass);
  // When going back, clear arm if the previous class does not need one.
  let prevArm = currentRow.arm;
  if (!rule.required) {
    prevArm = null;
  }

  const changes = {
    class_level: prevClass,
    division: divisionOfClass(prevClass),
    arm: prevArm,
  };


  return { ok: true, changes };
}

/**
 * Validates an edit. `changes` uses database column names.
 * Status-only changes (archive and restore) are checked for value only, so they
 * always work, even on an older record that would fail the full profile check.
 * Returns { ok, changes, code, message }.
 */
function validateEdit(currentRow, changes) {
  const keys = Object.keys(changes || {});
  const hasStatus = keys.includes('status');
  const profileKeys = keys.filter((k) => k !== 'status');

  if (hasStatus && !STATUS_EDIT_VALUES.includes(changes.status)) {
    return { ok: false, code: 'INVALID_STATUS', message: 'Status can only be set to active or archived.' };
  }

  for (const key of profileKeys) {
    const api = DB_TO_API[key];
    if (!api || !EDITABLE_API_FIELDS.includes(api)) {
      return { ok: false, code: 'FIELD_NOT_EDITABLE', message: `"${key}" cannot be changed this way.` };
    }
  }

  const clean = {};
  if (hasStatus) clean.status = changes.status;

  if (profileKeys.length === 0) {
    return { ok: true, changes: clean };
  }

  const merged = {};
  for (const [db, api] of Object.entries(DB_TO_API)) {
    let value = currentRow[db];
    // pg returns DATE columns as Date objects; the rules expect YYYY-MM-DD.
    if (value instanceof Date) value = value.toISOString().slice(0, 10);
    merged[api] = value;
  }
  for (const key of profileKeys) merged[DB_TO_API[key]] = changes[key];

  let sessionClean;
  if ('academic_session' in changes) {
    const { normalizeSession } = require('./academicSession');
    const raw = changes.academic_session;
    sessionClean = raw === null || raw === '' ? null : normalizeSession(String(raw));
    if (raw !== null && raw !== '' && !sessionClean) {
      return { ok: false, code: 'RECORD_INVALID', message: 'Academic session must look like 2024/2025.' };
    }
  }

  const check = normalizeStudent(merged);
  if (!check.ok) {
    return { ok: false, code: 'RECORD_INVALID', message: check.errors[0] };
  }

  for (const key of profileKeys) {
    if (key === 'academic_session' || key === 'registered_term') continue;
    clean[key] = check.value[DB_TO_API[key]];
  }
  if ('academic_session' in changes) clean.academic_session = sessionClean;
  if ('registered_term' in changes) {
    const t = changes.registered_term;
    if (t !== null && !['First', 'Second', 'Third'].includes(t)) {
      return { ok: false, code: 'RECORD_INVALID', message: 'Registered term must be First, Second or Third.' };
    }
    clean.registered_term = t;
  }
  return { ok: true, changes: clean };
}

module.exports = { planPromotion, planUndoPromotion, validateEdit, DB_TO_API, API_TO_DB, STATUS_EDIT_VALUES };

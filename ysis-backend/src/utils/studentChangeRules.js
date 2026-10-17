'use strict';

/**
 * Promotion and edit rules. Pure functions: they plan the change, the caller
 * writes it. Used by the REST promote route, the sync promote_student and
 * edit_student operations.
 */

const { getNextClass, isAtMaxClass } = require('./classProgression');
const { normalizeStudent, cleanText, canonicalClass, divisionOfClass, armRuleFor } = require('./studentRules');

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
};
const API_TO_DB = Object.fromEntries(Object.entries(DB_TO_API).map(([k, v]) => [v, k]));

// Fields a normal edit may change. Division and class are never edited
// directly; they change only through promotion. Status is never editable here.
const EDITABLE_API_FIELDS = ['admissionNo', 'fullName', 'arm', 'gender', 'guardianName', 'guardianPhone'];

/**
 * Plans a promotion. The next class is always the one the progression defines,
 * never a value the client chooses. Division follows the new class. Arm is
 * required when the new class needs one, and forbidden otherwise.
 *
 * Returns { ok, changes, code, message } where changes uses database column names.
 */
function planPromotion(currentRow, { newClassLevel, arm }) {
  if (isAtMaxClass(currentRow.class_level)) {
    return { ok: false, code: 'ALREADY_AT_MAX_CLASS', message: 'This student is already at SS3. They should be graduated, not promoted.' };
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

  return {
    ok: true,
    changes: {
      class_level: expected,
      division: divisionOfClass(expected),
      arm: nextArm,
      status: 'promoted',
    },
  };
}

/**
 * Validates an edit against the merged record. `changes` uses database column names.
 * Returns { ok, changes, code, message }.
 */
function validateEdit(currentRow, changes) {
  const keys = Object.keys(changes || {});
  for (const key of keys) {
    const api = DB_TO_API[key];
    if (!api || !EDITABLE_API_FIELDS.includes(api)) {
      return { ok: false, code: 'FIELD_NOT_EDITABLE', message: `"${key}" cannot be changed this way.` };
    }
  }

  const merged = {};
  for (const [db, api] of Object.entries(DB_TO_API)) merged[api] = currentRow[db];
  for (const key of keys) merged[DB_TO_API[key]] = changes[key];

  const check = normalizeStudent(merged);
  if (!check.ok) {
    return { ok: false, code: 'RECORD_INVALID', message: check.errors[0] };
  }

  const clean = {};
  for (const key of keys) {
    const api = DB_TO_API[key];
    clean[key] = check.value[api];
  }
  return { ok: true, changes: clean };
}

module.exports = { planPromotion, validateEdit, DB_TO_API, API_TO_DB };

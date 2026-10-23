'use strict';

/**
 * Shared student validation rules. Used by:
 *   - POST /students
 *   - the sync create_student and edit operations
 *   - promotion and edit validation (src/utils/studentChangeRules.js)
 *   - the bulk import script
 *
 * Pure functions only: no database access here.
 */

const { CLASS_ORDER } = require('./classProgression');

const DIVISIONS = ['primary', 'secondary'];
const ARMS = ['Science', 'Arts', 'Commercial'];
const GENDERS = ['M', 'F'];

const MAX_LENGTH = { admissionNo: 30, fullName: 100, guardianName: 100, guardianPhone: 20 };

const ADMISSION_NO_PATTERN = /^YMS\/(\d{4})\/(\d{2})\/(\d{3})$/;
const NAME_PATTERN = /^\p{L}[\p{L} .'\u2019-]*$/u;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const FORMULA_START = /^[=+\-@\t\r]/;

const CLASS_LOOKUP = new Map(
  CLASS_ORDER.map((c) => [c.toLowerCase().replace(/\s+/g, ''), c])
);
const ARM_LOOKUP = new Map(ARMS.map((a) => [a.toLowerCase(), a]));

// Admission numbers are YMS/YEAR/GROUP/SERIAL, e.g. YMS/2024/03/033.
const ADMISSION_PREFIX = 'YMS';
const ADMISSION_FIRST_YEAR = 2016;

/** Year from the school's first year to next year; group 01-99; serial 001-999. */
function admissionNoInRange(value) {
  const m = ADMISSION_NO_PATTERN.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  return (
    year >= ADMISSION_FIRST_YEAR &&
    year <= new Date().getFullYear() + 1 &&
    Number(m[2]) >= 1 &&
    Number(m[3]) >= 1
  );
}

/**
 * Typing guard for the admission number field. Uppercases, drops anything that
 * is not a letter or digit, and lays the rest out as YMS/YYYY/NN/NNN.
 */
function formatAdmissionInput(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let i = 0;
  while (i < s.length && i < ADMISSION_PREFIX.length && s[i] === ADMISSION_PREFIX[i]) i += 1;
  const d = s.slice(i).replace(/\D/g, '').slice(0, 9);
  if (!d) return s.slice(0, i);
  let out = `${ADMISSION_PREFIX}/${d.slice(0, 4)}`;
  if (d.length > 4) out += `/${d.slice(4, 6)}`;
  if (d.length > 6) out += `/${d.slice(6)}`;
  return out;
}

/** Removes control and invisible characters, normalizes Unicode, collapses spaces. */
function cleanText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Canonical class name for any spelling ("ss 2" -> "SS2"), or null if unknown. */
function canonicalClass(raw) {
  return CLASS_LOOKUP.get(cleanText(raw).toLowerCase().replace(/\s+/g, '')) || null;
}

/** Which division a canonical class belongs to. */
function divisionOfClass(classLevel) {
  return /^(KG|Primary)/.test(classLevel) ? 'primary' : 'secondary';
}

/**
 * Arm rule by class (confirmed by the school):
 *   KG1 to Primary 6: no arm
 *   JSS1 to SS1:      no arm
 *   SS2 and SS3:      required, Science / Arts / Commercial
 * JSS sections (A, B) are out of scope and are not recorded.
 */
function armRuleFor(classLevel) {
  if (classLevel === 'SS2' || classLevel === 'SS3') {
    return { required: true, allowed: ARMS };
  }
  return { required: false, allowed: [] };
}

/**
 * Validates and cleans one student record.
 * Input keys are camelCase (the API shape). Returns { ok, value, errors }.
 * Errors name the FIELD only, never the value.
 */
function normalizeStudent(input = {}) {
  const errors = [];
  const v = {};

  if (input.dateOfBirth !== undefined && input.dateOfBirth !== null && input.dateOfBirth !== '') {
    errors.push('dateOfBirth: no longer accepted');
  }

  v.admissionNo = cleanText(input.admissionNo).toUpperCase();
  if (!v.admissionNo) errors.push('admissionNo: required');
  else if (v.admissionNo.length > MAX_LENGTH.admissionNo) errors.push('admissionNo: too long');
  else if (!ADMISSION_NO_PATTERN.test(v.admissionNo)) errors.push('admissionNo: must look like YMS/2024/03/033');
  else if (!admissionNoInRange(v.admissionNo)) errors.push('admissionNo: year or number is out of range');

  v.fullName = cleanText(input.fullName);
  if (!v.fullName) errors.push('fullName: required');
  else if (v.fullName.length > MAX_LENGTH.fullName) errors.push('fullName: too long');
  else if (FORMULA_START.test(v.fullName)) errors.push('fullName: starts with a character not allowed here');
  else if (!NAME_PATTERN.test(v.fullName)) errors.push('fullName: contains characters that are not allowed');

  v.division = cleanText(input.division).toLowerCase();
  if (!DIVISIONS.includes(v.division)) errors.push('division: must be primary or secondary');

  v.classLevel = canonicalClass(input.classLevel);
  if (!v.classLevel) {
    errors.push('classLevel: not a recognized class');
  } else if (DIVISIONS.includes(v.division) && divisionOfClass(v.classLevel) !== v.division) {
    errors.push('classLevel: does not belong to the given division');
  }

  // Arm depends on the class, not the division.
  const armRaw = cleanText(input.arm);
  if (v.classLevel) {
    const rule = armRuleFor(v.classLevel);
    if (!rule.required) {
      if (armRaw) errors.push('arm: not allowed for this class');
      v.arm = null;
    } else {
      v.arm = ARM_LOOKUP.get(armRaw.toLowerCase()) || null;
      if (!v.arm) errors.push('arm: must be Science, Arts, or Commercial for this class');
    }
  } else {
    v.arm = armRaw || null; // class already rejected above
  }

  const genderRaw = cleanText(input.gender).toUpperCase();
  if (genderRaw === '') v.gender = null;
  else if (GENDERS.includes(genderRaw)) v.gender = genderRaw;
  else errors.push('gender: must be M or F');

  v.guardianName = cleanText(input.guardianName) || null;
  if (v.guardianName) {
    if (v.guardianName.length > MAX_LENGTH.guardianName) errors.push('guardianName: too long');
    else if (FORMULA_START.test(v.guardianName)) errors.push('guardianName: starts with a character not allowed here');
    else if (!NAME_PATTERN.test(v.guardianName)) errors.push('guardianName: contains characters that are not allowed');
  }

  v.guardianPhone = cleanText(input.guardianPhone).replace(/[\s-]/g, '') || null;
  if (v.guardianPhone) {
    if (v.guardianPhone.length > MAX_LENGTH.guardianPhone) errors.push('guardianPhone: too long');
    else if (!PHONE_PATTERN.test(v.guardianPhone)) errors.push('guardianPhone: not a valid phone number');
  }

  return { ok: errors.length === 0, value: v, errors };
}

module.exports = {
  DIVISIONS, ARMS, GENDERS, normalizeStudent, cleanText, canonicalClass, divisionOfClass, armRuleFor,
  formatAdmissionInput, admissionNoInRange,
};

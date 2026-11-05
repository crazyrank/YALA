'use strict';

/**
 * Biodata v1 validation. Pure functions only: no database access here.
 * Every field is optional. A field set to null or an empty string is cleared.
 * Unknown fields are rejected, so a client can never write another column.
 */

const { cleanText } = require('./studentRules');

const NAME_PATTERN = /^\p{L}[\p{L} .'\u2019-]*$/u;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const FORMULA_START = /^[=+\-@\t\r]/;
const LIVING_WITH = ['both_parents', 'one_parent', 'guardian'];

const FIELDS = {
  father_name: { type: 'name', max: 100, label: "Father's name" },
  mother_name: { type: 'name', max: 100, label: "Mother's name" },
  guardian_relationship: { type: 'text', max: 50, label: 'Guardian relationship' },
  home_address: { type: 'text', max: 250, label: 'Home address' },
  alt_phone: { type: 'phone', label: 'Alternate phone' },
  religion: { type: 'text', max: 50, label: 'Religion' },
  nationality: { type: 'text', max: 60, label: 'Nationality' },
  admission_date: { type: 'date', label: 'Admission date' },
  previous_school: { type: 'text', max: 150, label: 'Previous school' },
  last_class_studied: { type: 'text', max: 50, label: 'Last class studied' },
  state_of_origin: { type: 'text', max: 60, label: 'State of origin' },
  lga_of_origin: { type: 'text', max: 80, label: 'LGA of origin' },
  town_or_village: { type: 'text', max: 80, label: 'Town or village' },
  has_birth_certificate: { type: 'bool', label: 'Birth certificate' },
  emergency_contact_name: { type: 'name', max: 100, label: 'Emergency contact name' },
  emergency_contact_phone: { type: 'phone', label: 'Emergency contact phone' },
  emergency_contact_relationship: { type: 'text', max: 50, label: 'Emergency contact relationship' },
  allergies_conditions: { type: 'text', max: 500, label: 'Allergies and conditions' },
  living_with: { type: 'enum', values: LIVING_WITH, label: 'Living with' },
};

const FIELD_NAMES = Object.keys(FIELDS);

function fail(code, message) {
  return { ok: false, code, message };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
  return y >= 2000 && y <= new Date().getFullYear() + 1;
}

/** Returns { ok: true, changes } with cleaned values, or { ok: false, code, message }. */
function validateBiodata(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('VALIDATION_ERROR', 'Send the biodata fields as an object.');
  }

  const changes = {};
  for (const key of Object.keys(body)) {
    const rule = FIELDS[key];
    if (!rule) return fail('UNKNOWN_FIELD', `"${key}" is not a biodata field.`);

    let value = body[key];
    if (value === null || value === undefined) {
      changes[key] = null;
      continue;
    }

    if (rule.type === 'bool') {
      if (typeof value !== 'boolean') return fail('VALIDATION_ERROR', `${rule.label} must be yes or no.`);
      changes[key] = value;
      continue;
    }

    if (typeof value !== 'string') return fail('VALIDATION_ERROR', `${rule.label} must be text.`);

    if (rule.type === 'phone') {
      value = cleanText(value).replace(/[\s()-]/g, '');
      if (value === '') { changes[key] = null; continue; }
      if (!PHONE_PATTERN.test(value)) return fail('VALIDATION_ERROR', `${rule.label} is not a valid phone number.`);
      changes[key] = value;
      continue;
    }

    value = cleanText(value);
    if (value === '') { changes[key] = null; continue; }

    if (rule.type === 'date') {
      if (!validDate(value)) return fail('VALIDATION_ERROR', `${rule.label} must be a real date (YYYY-MM-DD).`);
    } else if (rule.type === 'enum') {
      if (!rule.values.includes(value)) return fail('VALIDATION_ERROR', `${rule.label} must be one of: ${rule.values.join(', ')}.`);
    } else {
      if (value.length > rule.max) return fail('VALIDATION_ERROR', `${rule.label} is too long (max ${rule.max}).`);
      if (rule.type === 'name') {
        if (!NAME_PATTERN.test(value)) return fail('VALIDATION_ERROR', `${rule.label} can only contain letters, spaces and . ' -`);
      } else if (FORMULA_START.test(value)) {
        return fail('VALIDATION_ERROR', `${rule.label} cannot start with = + - or @.`);
      }
    }
    changes[key] = value;
  }

  if (Object.keys(changes).length === 0) return fail('NO_CHANGES', 'No biodata fields were sent.');
  return { ok: true, changes };
}

module.exports = { FIELDS, FIELD_NAMES, LIVING_WITH, validateBiodata };

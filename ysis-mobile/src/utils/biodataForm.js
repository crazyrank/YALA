/**
 * Biodata form helpers. Pure functions, no screen code.
 * The server (biodataRules.js) is the source of truth; these limits only guide typing.
 */
import { dobToIso, isoToDob } from './dobFormat';

export const BIODATA_ROLES = ['director', 'principal', 'head_teacher', 'class_teacher'];

export const LIVING_WITH_OPTIONS = [
  { value: 'both_parents', label: 'Both parents' },
  { value: 'one_parent', label: 'One parent' },
  { value: 'guardian', label: 'Guardian' },
];

export const FIELD_GROUPS = [
  {
    title: 'FAMILY',
    fields: [
      { key: 'father_name', label: "Father's name", type: 'text', max: 100, caps: 'words' },
      { key: 'mother_name', label: "Mother's name", type: 'text', max: 100, caps: 'words' },
      { key: 'guardian_relationship', label: 'Guardian relationship', type: 'text', max: 50, caps: 'words' },
      { key: 'home_address', label: 'Home address', type: 'multiline', max: 250, caps: 'sentences' },
      { key: 'alt_phone', label: 'Alternate phone', type: 'phone', max: 20 },
      { key: 'living_with', label: 'Living with', type: 'living' },
    ],
  },
  {
    title: 'ORIGIN AND BACKGROUND',
    fields: [
      { key: 'nationality', label: 'Nationality', type: 'text', max: 60, caps: 'words' },
      { key: 'religion', label: 'Religion', type: 'text', max: 50, caps: 'words' },
      { key: 'state_of_origin', label: 'State of origin', type: 'text', max: 60, caps: 'words' },
      { key: 'lga_of_origin', label: 'LGA of origin', type: 'text', max: 80, caps: 'words' },
      { key: 'town_or_village', label: 'Town or village', type: 'text', max: 80, caps: 'words' },
      { key: 'has_birth_certificate', label: 'Birth certificate', type: 'bool' },
      { key: 'admission_date', label: 'Admission date', type: 'date' },
      { key: 'previous_school', label: 'Previous school', type: 'text', max: 150, caps: 'words' },
      { key: 'last_class_studied', label: 'Last class studied', type: 'text', max: 50, caps: 'words' },
    ],
  },
  {
    title: 'SAFETY AND HEALTH',
    fields: [
      { key: 'emergency_contact_name', label: 'Emergency contact name', type: 'text', max: 100, caps: 'words' },
      { key: 'emergency_contact_phone', label: 'Emergency contact phone', type: 'phone', max: 20 },
      { key: 'emergency_contact_relationship', label: 'Emergency contact relationship', type: 'text', max: 50, caps: 'words' },
      { key: 'allergies_conditions', label: 'Allergies and conditions', type: 'multiline', max: 500, caps: 'sentences' },
    ],
  },
];

/** Server record -> editable form values (strings, or true/false/null for the yes/no field). */
export function toForm(data) {
  const form = {};
  FIELD_GROUPS.forEach((g) => g.fields.forEach((f) => {
    const v = data ? data[f.key] : null;
    if (f.type === 'bool') form[f.key] = v === true ? true : v === false ? false : null;
    else if (f.type === 'date') form[f.key] = v ? isoToDob(String(v).slice(0, 10)) : '';
    else form[f.key] = v == null ? '' : String(v);
  }));
  return form;
}

/** Only the fields that changed. Returns { patch } or { error }. Empty text becomes null (cleared). */
export function buildPatch(data, form) {
  const patch = {};
  for (const g of FIELD_GROUPS) {
    for (const f of g.fields) {
      const before = data ? data[f.key] : null;
      const now = form[f.key];
      if (f.type === 'bool') {
        const b = before === true ? true : before === false ? false : null;
        if (now !== b) patch[f.key] = now;
      } else if (f.type === 'date') {
        const iso = dobToIso(now);
        if (iso === null) return { error: `${f.label} must be a date like 25/03/2014.` };
        const b = before ? String(before).slice(0, 10) : '';
        if (iso !== b) patch[f.key] = iso === '' ? null : iso;
      } else {
        const trimmed = String(now ?? '').trim();
        const b = before == null ? '' : String(before);
        if (trimmed !== b) patch[f.key] = trimmed === '' ? null : trimmed;
      }
    }
  }
  return { patch };
}

/** Text shown in the read-only view. */
export function displayValue(field, data) {
  const v = data ? data[field.key] : null;
  if (field.type === 'bool') return v === true ? 'Yes' : v === false ? 'No' : '-';
  if (v == null || v === '') return '-';
  if (field.type === 'date') return isoToDob(String(v).slice(0, 10));
  if (field.type === 'living') {
    const o = LIVING_WITH_OPTIONS.find((x) => x.value === v);
    return o ? o.label : String(v);
  }
  return String(v);
}

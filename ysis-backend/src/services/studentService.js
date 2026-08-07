const db = require('../db');

const EDITABLE_FIELDS = [
  'full_name', 'date_of_birth', 'gender', 'division', 'class_level',
  'arm', 'guardian_name', 'guardian_phone', 'status',
];

/**
 * The single deterministic conflict-detection mechanism for the whole
 * system (Build Spec Section 12). Applies an edit only if the student's
 * sync_version still matches what the client last saw. Zero rows
 * affected means the record changed underneath the client — that IS the
 * conflict signal, not something the app has to separately notice.
 *
 * Returns { updated: true, student } on success,
 *         { updated: false } if a conflict was detected (caller inserts
 *         into `conflicts`).
 */
async function applyConditionalUpdate({ studentId, basedOnVersion, changes }) {
  const setFields = Object.keys(changes).filter((k) => EDITABLE_FIELDS.includes(k));
  if (setFields.length === 0) {
    return { updated: false, noOp: true };
  }

  const setClauses = setFields.map((field, i) => `${field} = $${i + 3}`).join(', ');
  const values = setFields.map((f) => changes[f]);

  const { rows } = await db.query(
    `UPDATE students
     SET ${setClauses}, sync_version = sync_version + 1, updated_at = now()
     WHERE id = $1 AND sync_version = $2
     RETURNING *`,
    [studentId, basedOnVersion, ...values]
  );

  if (rows.length === 0) {
    return { updated: false };
  }
  return { updated: true, student: rows[0] };
}

async function getCurrentServerState(studentId) {
  const { rows } = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
  return rows[0] || null;
}

module.exports = { applyConditionalUpdate, getCurrentServerState, EDITABLE_FIELDS };

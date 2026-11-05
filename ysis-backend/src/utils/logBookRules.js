/**
 * Log Book rules. Pure functions, no database.
 * The server decides the class (from the Class Teacher's one assignment), never the client.
 */
const MAX_BODY = 4000;
const MAX_BACKDATE_DAYS = 7;
const EDIT_WINDOW_HOURS = 24;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(earlier, later) {
  const ms = Date.parse(later + 'T00:00:00Z') - Date.parse(earlier + 'T00:00:00Z');
  return Math.round(ms / 86400000);
}

function checkBody(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, code: 'BODY_REQUIRED', message: 'Write what happened in the class.' };
  if (text.length > MAX_BODY) {
    return { ok: false, code: 'BODY_TOO_LONG', message: `Keep the entry under ${MAX_BODY} characters.` };
  }
  return { ok: true, value: text };
}

/** `today` is the school's current date (YYYY-MM-DD, Africa/Lagos), passed in by the route. */
function validateNewEntry({ entryDate, body, today }) {
  const text = checkBody(body);
  if (!text.ok) return text;
  if (typeof entryDate !== 'string' || !DATE_PATTERN.test(entryDate)) {
    return { ok: false, code: 'DATE_INVALID', message: 'Choose a valid date.' };
  }
  if (entryDate > today) {
    return { ok: false, code: 'DATE_IN_FUTURE', message: 'An entry cannot be dated in the future.' };
  }
  if (daysBetween(entryDate, today) > MAX_BACKDATE_DAYS) {
    return { ok: false, code: 'DATE_TOO_OLD', message: `Entries can be dated up to ${MAX_BACKDATE_DAYS} days back.` };
  }
  return { ok: true, value: { entryDate, body: text.value } };
}

function validateCorrection({ body }) {
  const text = checkBody(body);
  if (!text.ok) return text;
  return { ok: true, value: { body: text.value } };
}

module.exports = {
  MAX_BODY,
  MAX_BACKDATE_DAYS,
  EDIT_WINDOW_HOURS,
  DATE_PATTERN,
  validateNewEntry,
  validateCorrection,
};

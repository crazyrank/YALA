/**
 * Staff Report rules. Pure functions, no database.
 * The server decides who may write about whom. The client never decides scope.
 */
const MAX_COMMENT = 1000;
const EDIT_WINDOW_HOURS = 24;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const RECOGNITIONS = ['none', 'teacher_of_the_month', 'teacher_of_the_year'];
const SUBJECT_ROLES = ['head_teacher', 'class_teacher'];

function validateScore(raw) {
  let n = NaN;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    return { ok: false, code: 'SCORE_INVALID', message: 'Choose a score from 1 to 10.' };
  }
  return { ok: true, value: n };
}

function validateComment(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, code: 'COMMENT_REQUIRED', message: 'Write a short comment about this person.' };
  if (text.length > MAX_COMMENT) {
    return { ok: false, code: 'COMMENT_TOO_LONG', message: `Keep the comment under ${MAX_COMMENT} characters.` };
  }
  return { ok: true, value: text };
}

function validateRecognition(raw) {
  const value = raw === undefined || raw === null || raw === '' ? 'none' : raw;
  if (!RECOGNITIONS.includes(value)) {
    return { ok: false, code: 'RECOGNITION_INVALID', message: 'Choose a recognition option from the list.' };
  }
  return { ok: true, value };
}

function validateReport({ score, comment, recognition }) {
  const s = validateScore(score);
  if (!s.ok) return s;
  const c = validateComment(comment);
  if (!c.ok) return c;
  const r = validateRecognition(recognition);
  if (!r.ok) return r;
  return { ok: true, value: { score: s.value, comment: c.value, recognition: r.value } };
}

/**
 * Principal: any active Head Teacher or Class Teacher, not themselves.
 * Head Teacher: active Class Teachers whose division is in their own scope.
 */
function canWriteAbout({ writerRole, writerId, writerDivisions, subject }) {
  if (!subject || subject.status !== 'active') return false;
  if (subject.id === writerId) return false;
  if (!SUBJECT_ROLES.includes(subject.role)) return false;
  if (writerRole === 'principal') return true;
  if (writerRole === 'head_teacher') {
    return subject.role === 'class_teacher' && writerDivisions.includes(subject.division);
  }
  return false;
}

module.exports = {
  MAX_COMMENT,
  EDIT_WINDOW_HOURS,
  MONTH_PATTERN,
  RECOGNITIONS,
  validateReport,
  canWriteAbout,
};

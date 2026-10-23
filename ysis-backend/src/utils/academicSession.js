// Academic session for a registration date. Sessions run September to August.
// Dates are read in Lagos time (UTC+1, no daylight saving), so the phone and
// the server always agree on the session for a record.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const SESSION_START_MONTH = 9; // September, 1-based

function academicSessionFor(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const local = new Date(d.getTime() + LAGOS_OFFSET_MS);
  const month = local.getUTCMonth() + 1;
  const startYear = month >= SESSION_START_MONTH
    ? local.getUTCFullYear()
    : local.getUTCFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}

// Sessions the school can choose from. The school opened in September 2016,
// so 2016/2017 is the earliest. From July the coming session opens for
// registration, so a student can be registered ahead of September.
const FIRST_SESSION_START_YEAR = 2016;
const NEXT_SESSION_OPENS_MONTH = 7;

function availableSessions(now = new Date()) {
  const current = academicSessionFor(now);
  if (!current) return [];
  const local = new Date(new Date(now).getTime() + LAGOS_OFFSET_MS);
  const month = local.getUTCMonth() + 1;
  let lastStart = Number(current.slice(0, 4));
  if (month >= NEXT_SESSION_OPENS_MONTH && month < SESSION_START_MONTH) lastStart += 1;
  const list = [];
  for (let y = FIRST_SESSION_START_YEAR; y <= lastStart; y += 1) list.push(`${y}/${y + 1}`);
  return list;
}

// Returns the cleaned session when it is one the school can choose, else null.
function normalizeSession(value, now = new Date()) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return availableSessions(now).includes(clean) ? clean : null;
}

module.exports = {
  academicSessionFor,
  availableSessions,
  normalizeSession,
  SESSION_START_MONTH,
  FIRST_SESSION_START_YEAR,
};

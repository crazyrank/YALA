// Academic session for a registration date. Sessions run September to August.
// Dates are read in Lagos time (UTC+1, no daylight saving), so the phone and
// the server always agree on the session for a record.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const SESSION_START_MONTH = 9; // September, 1-based

export function academicSessionFor(value) {
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

export { SESSION_START_MONTH };

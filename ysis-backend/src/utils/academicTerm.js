// Registered term from the registration date, in Lagos time.
// September to December: First. January to March: Second. April to July: Third.
// August is the holiday, so no term is recorded.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

function registeredTermFor(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const month = new Date(d.getTime() + LAGOS_OFFSET_MS).getUTCMonth() + 1;
  if (month >= 9 && month <= 12) return 'First';
  if (month >= 1 && month <= 3) return 'Second';
  if (month >= 4 && month <= 7) return 'Third';
  return null;
}

module.exports = { registeredTermFor };

/**
 * Canonical, ordered list of every class the school uses, low to high
 * (Build Spec Section 2: Primary = KG stages + Primary 1-6, Secondary =
 * JSS1-3 + SS1-3). This is the authoritative server-side copy — the
 * client's copy (src/utils/classProgression.js) is for instant local UI
 * only; the server is what actually enforces the SS3 cap, since a
 * modified/stale client can't be trusted to self-enforce it.
 *
 * Labels must exactly match what's stored in `students.class_level`.
 */
const CLASS_ORDER = [
  'KG1',
  'KG2',
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'Primary 6',
  'JSS1',
  'JSS2',
  'JSS3',
  'SS1',
  'SS2',
  'SS3',
];

/**
 * Returns the next class in the progression, or null if the student is
 * already at SS3 (the ceiling) or `currentClassLevel` isn't recognized.
 */
function getNextClass(currentClassLevel) {
  const idx = CLASS_ORDER.indexOf(currentClassLevel);

  if (idx === -1 || idx === CLASS_ORDER.length - 1) {
    return null;
  }

  return CLASS_ORDER[idx + 1];
}

/** True once a student has reached the top of the progression (SS3). */
function isAtMaxClass(currentClassLevel) {
  return (
    currentClassLevel ===
    CLASS_ORDER[CLASS_ORDER.length - 1]
  );
}

module.exports = {
  CLASS_ORDER,
  getNextClass,
  isAtMaxClass,
};

/**
 * Leave statuses on the phone. Must match the server rules in
 * ysis-backend/src/utils/leaveRules.js.
 */
export const LEAVER_STATUSES = ['graduated', 'transferred', 'withdrawn', 'expelled', 'deceased', 'not_admitted'];

// A student can leave only from one of these statuses.
export const LEAVABLE_STATUSES = ['registered', 'active', 'promoted', 'inactive'];

export const LEAVE_LABELS = {
  graduated: 'Graduated',
  transferred: 'Transferred',
  withdrawn: 'Withdrawn',
  expelled: 'Expelled',
  deceased: 'Deceased',
  not_admitted: 'Not Admitted',
};

// Flip to true at release step 6, after the server flag is on.
export const NEW_STATUSES_ON = false;

/** The leave types offered for this student. The server checks every rule again. */
export function leaveOptionsFor(student) {
  // Without an entrance result, a Primary 5 pupil can only be recorded as Deceased.
  if (student?.class_level === 'Primary 5' && !student?.entrance_outcome) {
    return NEW_STATUSES_ON ? ['deceased'] : [];
  }
  const options = ['transferred', 'withdrawn', 'expelled'];
  if (NEW_STATUSES_ON) options.push('deceased');
  if (student?.class_level === 'SS3') options.unshift('graduated');
  if (NEW_STATUSES_ON && student?.class_level === 'Primary 5' && student?.entrance_outcome === 'not_admitted') {
    options.push('not_admitted');
  }
  return options;
}

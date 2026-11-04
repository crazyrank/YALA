/**
 * Leave rules (Build Spec Section 3). Only the Principal and Director record a
 * leave; the route enforces the role. This module decides whether a leave is
 * allowed and what changes. It never touches the database.
 */

const LEAVE_TYPES = ['graduated', 'transferred', 'withdrawn', 'expelled', 'deceased', 'not_admitted'];

// Statuses that mean the student has left. Every leave type is also a status.
const LEAVER_STATUSES = LEAVE_TYPES;

// A student can leave only from one of these statuses.
const LEAVABLE_STATUSES = ['registered', 'active', 'promoted', 'inactive'];

// Phones that have not rebuilt their local table yet cannot store these values.
// They are refused until ENABLE_NEW_STUDENT_STATUSES=true is set on the server.
const NEW_STATUS_TYPES = ['deceased', 'not_admitted'];

function newStatusesEnabled() {
  return process.env.ENABLE_NEW_STUDENT_STATUSES === 'true';
}

function hasLeft(status) {
  return LEAVER_STATUSES.includes(status);
}

/**
 * Plans a leave. Returns { ok, changes, record } or { ok: false, code, message }.
 * changes uses database column names. record is the student_leaves row content.
 */
function planLeave(student, { leaveType, reason }) {
  if (!LEAVE_TYPES.includes(leaveType)) {
    return { ok: false, code: 'INVALID_LEAVE_TYPE', message: 'Choose a valid leave type.' };
  }
  if (NEW_STATUS_TYPES.includes(leaveType) && !newStatusesEnabled()) {
    return { ok: false, code: 'NOT_ENABLED_YET', message: 'This leave type is not available yet. Update the app first.' };
  }
  if (!LEAVABLE_STATUSES.includes(student.status)) {
    return { ok: false, code: 'ALREADY_LEFT', message: `This student's status is ${student.status} and cannot be changed to a leave.` };
  }

  // Primary 5 pupils with no recorded entrance result cannot leave.
  if (student.class_level === 'Primary 5' && !student.entrance_outcome && leaveType !== 'deceased') {
    return { ok: false, code: 'RESULT_PENDING', message: 'This pupil has no recorded entrance result yet. Record it before recording a leave.' };
  }
  if (leaveType === 'graduated' && student.class_level !== 'SS3') {
    return { ok: false, code: 'GRADUATE_ONLY_FROM_SS3', message: 'Only SS3 students can be recorded as Graduated.' };
  }
  if (leaveType === 'not_admitted' && !(student.class_level === 'Primary 5' && student.entrance_outcome === 'not_admitted')) {
    return { ok: false, code: 'NOT_ADMITTED_MISMATCH', message: 'Not Admitted applies only to Primary 5 pupils whose entrance result is Not Admitted.' };
  }

  const leaveSession = student.current_session || student.academic_session || null;
  if (!leaveSession) {
    return { ok: false, code: 'SESSION_REQUIRED', message: 'This student has no session recorded, so the leave cannot be filed under a session.' };
  }

  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  return {
    ok: true,
    changes: { status: leaveType },
    record: { leave_type: leaveType, leave_session: leaveSession, reason: cleanReason || null },
  };
}

/**
 * The status a Guest is allowed to see: Active, Inactive, or Left. Every leave
 * type shows as the same generic value, so the reason is never revealed.
 * Inactive is sent only once the new statuses are enabled.
 */
function guestStatusFor(status) {
  if (hasLeft(status)) return 'withdrawn';
  if (status === 'inactive' && newStatusesEnabled()) return 'inactive';
  return 'active';
}

module.exports = { LEAVE_TYPES, LEAVER_STATUSES, LEAVABLE_STATUSES, planLeave, hasLeft, guestStatusFor, newStatusesEnabled };

/**
 * Registration approval rules (Build Spec Section 2).
 *  - Head Teacher, Principal and Director registrations are Approved immediately.
 *  - Class Teacher registrations are Pending until the Head Teacher of that
 *    division (or the Principal or Director) approves them.
 *  - A returned record goes back to the Class Teacher with a reason. They fix it
 *    and resubmit, which makes it Pending again.
 *  - A Class Teacher can edit a record only while it is Pending or Returned.
 * This module decides what is allowed. It never touches the database.
 */

const APPROVAL_STATUSES = ['pending', 'approved', 'returned'];
const APPROVER_ROLES = ['head_teacher', 'principal', 'director'];

/** The role decides this on the server. A client can never choose it. */
function approvalStatusForRegistration(role) {
  return role === 'class_teacher' ? 'pending' : 'approved';
}

function planApproval(student) {
  if (student.approval_status !== 'pending') {
    return { ok: false, code: 'NOT_PENDING', message: 'Only a registration that is waiting for approval can be approved.' };
  }
  return { ok: true, changes: { approval_status: 'approved', return_reason: null } };
}

function planReturn(student, reason) {
  if (student.approval_status !== 'pending') {
    return { ok: false, code: 'NOT_PENDING', message: 'Only a registration that is waiting for approval can be returned.' };
  }
  const clean = typeof reason === 'string' ? reason.trim() : '';
  if (!clean) {
    return { ok: false, code: 'REASON_REQUIRED', message: 'Give a reason so the Class Teacher knows what to fix.' };
  }
  if (clean.length > 500) {
    return { ok: false, code: 'REASON_TOO_LONG', message: 'Keep the reason under 500 characters.' };
  }
  return { ok: true, changes: { approval_status: 'returned', return_reason: clean } };
}

/** Only the Class Teacher who registered the student can send it back for approval. */
function planResubmit(student, userId) {
  if (student.approval_status !== 'returned') {
    return { ok: false, code: 'NOT_RETURNED', message: 'Only a returned registration can be resubmitted.' };
  }
  if (!student.registered_by || student.registered_by !== userId) {
    return { ok: false, code: 'NOT_YOUR_REGISTRATION', message: 'Only the Class Teacher who registered this student can resubmit it.' };
  }
  return { ok: true, changes: { approval_status: 'pending', return_reason: null } };
}

function classTeacherMayEdit(student) {
  return student.approval_status === 'pending' || student.approval_status === 'returned';
}

module.exports = {
  APPROVAL_STATUSES,
  APPROVER_ROLES,
  approvalStatusForRegistration,
  planApproval,
  planReturn,
  planResubmit,
  classTeacherMayEdit,
};

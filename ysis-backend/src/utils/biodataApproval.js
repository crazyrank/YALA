'use strict';
/**
 * Biodata approval rules. Pure functions, no database access.
 *  - Head Teacher, Principal and Director saves are Approved at once.
 *  - Class Teacher saves are Pending until a Head Teacher, Principal or Director approves them.
 *  - A Class Teacher can edit only while the record is Pending or Returned (not Approved).
 *  - Approvers can approve a Pending record, or return it with a reason.
 * The role always comes from the server session, never from the client.
 */

const STAFF_ROLES = ['director', 'principal', 'head_teacher', 'class_teacher'];
const APPROVER_ROLES = ['head_teacher', 'principal', 'director'];

function isApprover(role) {
  return APPROVER_ROLES.includes(role);
}

/** current: 'pending' | 'approved' | 'returned' | null (no record yet). */
function planSave(role, current) {
  if (!STAFF_ROLES.includes(role)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Your role cannot save biodata.' };
  }
  if (isApprover(role)) {
    return { ok: true, status: 'approved' };
  }
  if (current === 'approved') {
    return {
      ok: false,
      code: 'NOT_EDITABLE',
      message: 'This biodata is approved. Ask the Head Teacher to return it if it needs changes.',
    };
  }
  return { ok: true, status: 'pending' };
}

/** action: 'approve' | 'return'. reason is required for 'return'. */
function planReview(role, current, action, reason) {
  if (!isApprover(role)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Only a Head Teacher, Principal or Director can review biodata.' };
  }
  if (current !== 'pending') {
    return { ok: false, code: 'NOT_PENDING', message: 'Only biodata waiting for approval can be approved or returned.' };
  }
  if (action === 'approve') {
    return { ok: true, status: 'approved', reason: null };
  }
  if (action === 'return') {
    const clean = typeof reason === 'string' ? reason.trim() : '';
    if (!clean) {
      return { ok: false, code: 'REASON_REQUIRED', message: 'Give a reason so the Class Teacher knows what to fix.' };
    }
    if (clean.length > 500) {
      return { ok: false, code: 'REASON_TOO_LONG', message: 'Keep the reason under 500 characters.' };
    }
    return { ok: true, status: 'returned', reason: clean };
  }
  return { ok: false, code: 'VALIDATION_ERROR', message: 'Action must be approve or return.' };
}

module.exports = { STAFF_ROLES, APPROVER_ROLES, planSave, planReview };

/**
 * Registration approval on the phone. Mirrors ysis-backend/src/utils/approvalRules.js.
 * A missing status means an older record, which is approved.
 */
export function approvalOf(student) {
  return student?.approval_status || 'approved';
}

export function canApproveRecords(role) {
  return role === 'head_teacher' || role === 'principal' || role === 'director';
}

export function approvalNotice(student) {
  const status = approvalOf(student);
  if (status === 'pending') return 'Waiting for the Head Teacher to approve this registration.';
  if (status === 'returned') return 'This registration was sent back for changes.';
  return 'Approved.';
}

// Fingerprint unlock is for staff only.
// Students never reach this code, but call this check anywhere the app
// offers fingerprint unlock, so a student session can never trigger it.
const STAFF_ROLES = ['director', 'principal', 'head_teacher', 'class_teacher'];

export function canUseFingerprint(role) {
  return STAFF_ROLES.includes(role);
}

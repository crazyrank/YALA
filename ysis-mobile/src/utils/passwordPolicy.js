/**
 * Client-side mirror of server password policy for immediate UX feedback.
 * Server remains the source of truth.
 */
const MIN_LENGTH = 10;

export function validatePasswordStrength(password) {
  if (typeof password !== 'string') {
    return { ok: false, message: 'Password must be a string.' };
  }
  if (password.length < MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${MIN_LENGTH} characters.` };
  }
  if (password.length > 128) {
    return { ok: false, message: 'Password is too long.' };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: 'Password must contain a lowercase letter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: 'Password must contain an uppercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: 'Password must contain a number.' };
  }
  return { ok: true };
}

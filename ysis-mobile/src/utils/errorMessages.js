/**
 * Human-friendly error messages for non-technical school staff.
 * Never show raw technical errors to users.
 */

// Network / connection
export const NETWORK_UNAVAILABLE =
  'No internet connection right now. You can keep working — changes will be saved on this device.';

export const REQUEST_TIMED_OUT =
  'The connection is too slow or unstable. Please try again in a moment.';

export const REQUEST_FAILED =
  'We couldn’t complete that action. Please try again.';

export const COULD_NOT_REACH_SERVER =
  'We couldn’t reach the school system right now. Please check your internet and try again.';

export const FIRST_LOGIN_NEEDS_INTERNET =
  'You need an internet connection for the first sign-in. After that, you can unlock with your fingerprint even when offline.';

export const SYNC_PROBLEM =
  'Some changes could not be sent to the school system yet. They are safely saved on this device and will try again later.';

// Login / Unlock
export const ENTER_EMAIL_PASSWORD =
  'Please enter your email and password to continue.';

export const COULD_NOT_SIGN_IN =
  'We couldn’t sign you in. Please check your email and password and try again.';

export const NO_BIOMETRIC_HARDWARE =
  'This phone doesn’t have a fingerprint or PIN set up. Please sign in with your password.';

export const BIOMETRIC_FAILED =
  'Fingerprint not recognised. Please try again or use your password.';

export const BIOMETRIC_ERROR =
  'We couldn’t verify your fingerprint. Please try again or sign in with your password.';

// Form validation
export const MISSING_NAME_EMAIL =
  'Please enter the full name and email address.';

export const MISSING_ADMISSION_NAME_CLASS =
  'Please enter the admission number, student name, and class.';

export const MISSING_NAME_CLASS =
  'Please enter the student name and class.';

export const MISSING_NAME_TITLE =
  'Please enter the full name and office/title.';

export const REASON_NEEDED =
  'Please tell us why this photo needs to be replaced.';

// Permissions
export const ONLY_PRINCIPAL_PROMOTE =
  'Only a Principal or Director can promote students. Please contact them if this needs to be done.';

export const ONLY_PRINCIPAL_EDIT =
  'Only a Principal or Director can edit student records. Please contact them if a change is needed.';

export const ONLY_PRINCIPAL_ARCHIVE =
  'Only a Principal or Director can archive students.';

export const PHOTO_PERMISSION =
  'Please allow access to your photos so you can choose a picture.';

// Common action failures
export const COULD_NOT_SAVE =
  'We couldn’t save this record. Please try again.';

export const COULD_NOT_SAVE_STUDENT =
  'We couldn’t save this student. Please try again. If it keeps happening, check your internet connection.';

export const COULD_NOT_SAVE_PHOTO =
  'We couldn’t save the photo. Please try again.';

export const COULD_NOT_LOAD =
  'We couldn’t load the information. Please try again.';

export const COULD_NOT_LOAD_STAFF =
  'We couldn’t load the staff list. Please try again.';

export const COULD_NOT_CREATE_ACCOUNT =
  'We couldn’t create the account. Please try again.';

export const COULD_NOT_PROMOTE =
  'We couldn’t promote this student. Please try again.';

export const COULD_NOT_ARCHIVE =
  'We couldn’t archive this student. Please try again.';

export const COULD_NOT_RESTORE =
  'We couldn’t restore this student. Please try again.';

export const COULD_NOT_REMOVE =
  'We couldn’t remove this entry. Please try again.';

export const EXPORT_FAILED =
  'We couldn’t export the student list. Please try again.';

export const EMAIL_ALREADY_IN_USE =
  'This email is already registered. Please use a different email or sign in.';

export const ACCOUNT_NEEDS_INTERNET =
  'Creating an account needs an internet connection. Please try again when you are online.';

/**
 * Turn any technical error into a friendly message.
 * Use this everywhere instead of err.message.
 */
export function toFriendlyError(err, fallback = REQUEST_FAILED) {
  if (!err) return fallback;

  if (err.isNetworkError) {
    if (err.message === 'Request timed out') return REQUEST_TIMED_OUT;
    return NETWORK_UNAVAILABLE;
  }

  // Common backend codes (add more as you discover them)
  const code = err.code || '';
  if (code === 'EMAIL_ALREADY_EXISTS' || code === 'EMAIL_IN_USE') {
    return EMAIL_ALREADY_IN_USE;
  }

  // Never show raw technical messages
  return fallback;
}

/**
 * Staff Profile visibility rules. Pure functions, no database.
 * The list route in staffProfiles.routes.js uses the same rules written as SQL.
 * If you change one, change the other.
 */

/**
 * Principal: any Class Teacher, and Head Teachers they created.
 * Director: any Class Teacher, and Principals and Head Teachers they created.
 * Head Teacher: Class Teachers in their own division.
 * Nobody opens their own profile here. Inactive (deleted) accounts are never shown.
 */
function canViewStaff({ viewerRole, viewerId, viewerDivisions, subject }) {
  if (!subject || subject.status === 'inactive') return false;
  if (subject.id === viewerId) return false;

  if (viewerRole === 'director') {
    if (subject.role === 'class_teacher') return true;
    return ['principal', 'head_teacher'].includes(subject.role) && subject.created_by === viewerId;
  }
  if (viewerRole === 'principal') {
    if (subject.role === 'class_teacher') return true;
    return subject.role === 'head_teacher' && subject.created_by === viewerId;
  }
  if (viewerRole === 'head_teacher') {
    return subject.role === 'class_teacher' && viewerDivisions.includes(subject.division);
  }
  return false;
}

/**
 * Profile edit rules. Pure functions, no database.
 * Only the name, email and phone can be changed. Role, status and class are never edited here.
 */
function validateProfileEdit({ fullName, email, phone }) {
  const name = typeof fullName === 'string' ? fullName.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 100) {
    return { ok: false, code: 'NAME_INVALID', message: 'Enter a name between 2 and 100 characters.' };
  }

  const mail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (mail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return { ok: false, code: 'EMAIL_INVALID', message: 'Enter a valid email address.' };
  }

  let phoneValue = null;
  if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
    phoneValue = String(phone).trim();
    if (!/^\+?[0-9 ()-]{7,20}$/.test(phoneValue)) {
      return { ok: false, code: 'PHONE_INVALID', message: 'Enter a valid phone number.' };
    }
  }

  return { ok: true, value: { fullName: name, email: mail, phone: phoneValue } };
}

module.exports = { canViewStaff, validateProfileEdit };

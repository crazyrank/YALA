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

module.exports = { canViewStaff };

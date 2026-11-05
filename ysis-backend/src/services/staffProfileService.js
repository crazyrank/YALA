const db = require('../db');
const { writeAudit } = require('../middleware/audit');
const { canViewStaff, validateProfileEdit } = require('../utils/staffProfileRules');

const ALLOWED_FIELDS = new Set(['fullName', 'email', 'phone', 'baseVersion']);

function rejectUnknownFields(payload) {
  return Object.keys(payload || {}).some((key) => !ALLOWED_FIELDS.has(key));
}

async function applyStaffProfileUpdate({ subjectId, payload, auth }) {
  if (!['principal', 'director'].includes(auth.role)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Only the principal or director can edit staff profiles.' };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || rejectUnknownFields(payload)) {
    return { ok: false, code: 'UNKNOWN_FIELDS', message: 'The profile update contains unsupported fields.' };
  }
  if (!Number.isSafeInteger(payload.baseVersion) || payload.baseVersion < 1) {
    return { ok: false, code: 'VERSION_REQUIRED', message: 'The profile version is missing. Refresh the profile before editing.' };
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'fullName') ||
      !Object.prototype.hasOwnProperty.call(payload, 'email')) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Name and email are required.' };
  }

  const checked = validateProfileEdit({
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
  });
  if (!checked.ok) return { ok: false, code: checked.code, message: checked.message };

  let result;
  try {
    result = await db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, full_name, email, phone, role, status, created_by, profile_version
           FROM users WHERE id = $1 FOR UPDATE`,
        [subjectId]
      );
      const subject = rows[0];
      if (!subject) return { ok: false, code: 'NOT_FOUND', message: 'That staff profile could not be found.' };

      if (!canViewStaff({
        viewerRole: auth.role,
        viewerId: auth.userId,
        viewerDivisions: [],
        subject,
      })) {
        return { ok: false, code: 'FORBIDDEN', message: 'You are not able to edit this profile.' };
      }

      if (Number(subject.profile_version) !== payload.baseVersion) {
        return {
          ok: false,
          conflict: true,
          code: 'PROFILE_VERSION_CONFLICT',
          message: 'This profile changed on the server. Review the latest details before trying again.',
        };
      }

      const { rows: taken } = await client.query(
        'SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1',
        [checked.value.email, subject.id]
      );
      if (taken.length) {
        return { ok: false, code: 'EMAIL_TAKEN', message: 'Another account already uses that email address.' };
      }

      const changed = [];
      if (checked.value.fullName !== subject.full_name) changed.push('name');
      if (checked.value.email !== subject.email) changed.push('email');
      if ((checked.value.phone || '') !== (subject.phone || '')) changed.push('phone');
      if (changed.length === 0) {
        return { ok: true, changed: [], profileVersion: Number(subject.profile_version) };
      }

      const updated = await client.query(
        `UPDATE users
            SET full_name = $2, email = $3, phone = $4,
                profile_version = profile_version + 1, updated_at = now()
          WHERE id = $1 AND profile_version = $5
          RETURNING profile_version`,
        [subject.id, checked.value.fullName, checked.value.email, checked.value.phone, payload.baseVersion]
      );
      if (!updated.rows[0]) {
        return { ok: false, conflict: true, code: 'PROFILE_VERSION_CONFLICT', message: 'This profile changed on the server. Review the latest details before trying again.' };
      }
      return { ok: true, changed, profileVersion: Number(updated.rows[0].profile_version) };
    });
  } catch (err) {
    if (err.code === '23505') {
      return { ok: false, code: 'EMAIL_TAKEN', message: 'Another account already uses that email address.' };
    }
    throw err;
  }

  if (result.ok && result.changed.length > 0) {
    await writeAudit({
      userId: auth.userId,
      deviceId: auth.deviceId,
      action: 'STAFF_PROFILE_EDITED',
      entityType: 'user',
      entityId: subjectId,
      result: 'success',
      metadata: { fields: result.changed },
    });
  }
  return result;
}

async function handleStaffProfileOperation({ operation, userId, userRole, deviceId, syncOpRowId, markStatus }) {
  const result = await applyStaffProfileUpdate({
    subjectId: operation.entityId,
    payload: operation.payload,
    auth: { userId, role: userRole, deviceId },
  });
  if (!result.ok) {
    await markStatus(syncOpRowId, result.conflict ? 'conflicted' : 'failed', result.message);
    return {
      operationId: operation.operationId,
      status: result.conflict ? 'conflicted' : 'failed',
      error: result.code,
      message: result.message,
    };
  }
  await markStatus(syncOpRowId, 'synced');
  return { operationId: operation.operationId, status: 'synced' };
}

module.exports = { applyStaffProfileUpdate, handleStaffProfileOperation };

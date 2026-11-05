'use strict';
/**
 * Staff directory writes queued from the phone. Same section rules as directory.routes.js.
 * The phone generates the entry id, so a retried create cannot make a duplicate.
 * A photo is uploaded before the row is saved; if the upload fails, nothing is saved.
 */
const db = require('../db');
const { uploadDirectoryPhoto } = require('./photoService');
const { writeAudit } = require('../middleware/audit');

const SECTION_CREATORS = {
  board: ['director'],
  management: ['director', 'principal'],
  class_teacher: ['director', 'principal', 'head_teacher'],
};

function fail(code, message) {
  return { ok: false, code, message };
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function applyCreate({ entryId, auth, section, fullName, title, photoBase64 }) {
  const allowed = SECTION_CREATORS[section];
  if (!allowed) return fail('VALIDATION_ERROR', 'Choose a valid section.');
  if (!allowed.includes(auth.role)) return fail('FORBIDDEN', 'You are not able to add entries to this section.');
  const name = cleanText(fullName);
  const role = cleanText(title);
  if (!name || !role) return fail('VALIDATION_ERROR', 'Enter a name and a title.');

  let photoUrl = null;
  if (typeof photoBase64 === 'string' && photoBase64) {
    try {
      photoUrl = await uploadDirectoryPhoto(photoBase64, entryId);
    } catch (err) {
      return fail('PHOTO_UPLOAD_FAILED', 'The photo could not be uploaded. Try again.');
    }
  }

  await db.query(
    `INSERT INTO staff_directory (id, section, full_name, title, photo_url, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [entryId, section, name, role, photoUrl, auth.userId]
  );
  return { ok: true, action: 'DIRECTORY_ENTRY_CREATED', metadata: { section } };
}

async function loadEntry(entryId) {
  const { rows } = await db.query(
    'SELECT id, section, linked_user_id FROM staff_directory WHERE id = $1',
    [entryId]
  );
  return rows[0] || null;
}

async function applyUpdate({ entryId, auth, fullName, title, photoBase64 }) {
  const entry = await loadEntry(entryId);
  if (!entry) return fail('NOT_FOUND', 'That staff directory entry could not be found.');
  if (!(SECTION_CREATORS[entry.section] || []).includes(auth.role)) {
    return fail('FORBIDDEN', 'You are not able to edit this entry.');
  }
  if (entry.linked_user_id) {
    return fail('FORBIDDEN', 'This card is linked to a login account and updates automatically.');
  }

  const name = fullName === undefined ? null : cleanText(fullName);
  const role = title === undefined ? null : cleanText(title);
  if (name === '' || role === '') return fail('VALIDATION_ERROR', 'Enter a name and a title.');

  let photoUrl = null;
  if (typeof photoBase64 === 'string' && photoBase64) {
    try {
      photoUrl = await uploadDirectoryPhoto(photoBase64, entryId);
    } catch (err) {
      return fail('PHOTO_UPLOAD_FAILED', 'The photo could not be uploaded. Try again.');
    }
  }

  await db.query(
    `UPDATE staff_directory
        SET full_name = COALESCE($2, full_name),
            title = COALESCE($3, title),
            photo_url = COALESCE($4, photo_url)
      WHERE id = $1`,
    [entryId, name, role, photoUrl]
  );
  return { ok: true, action: 'DIRECTORY_ENTRY_UPDATED', metadata: {} };
}

async function applyDelete({ entryId, auth }) {
  const entry = await loadEntry(entryId);
  if (!entry) return { ok: true, action: 'DIRECTORY_ENTRY_DELETED', metadata: {} }; // already removed
  if (!(SECTION_CREATORS[entry.section] || []).includes(auth.role)) {
    return fail('FORBIDDEN', 'You are not able to remove this entry.');
  }
  if (entry.linked_user_id) {
    return fail('FORBIDDEN', 'This card is linked to a login account and cannot be removed here.');
  }
  await db.query('DELETE FROM staff_directory WHERE id = $1', [entryId]);
  return { ok: true, action: 'DIRECTORY_ENTRY_DELETED', metadata: {} };
}

/** Runs one queued directory operation from /sync. */
async function handleDirectoryOperation({ operation, userId, userRole, deviceId, syncOpRowId, markStatus }) {
  const auth = { userId, role: userRole, deviceId };
  const { operationId, opType, entityId } = operation;
  const p = operation.payload || {};

  let result;
  if (opType === 'directory_create') {
    result = await applyCreate({ entryId: entityId, auth, section: p.section, fullName: p.fullName, title: p.title, photoBase64: p.photoBase64 });
  } else if (opType === 'directory_update') {
    result = await applyUpdate({ entryId: entityId, auth, fullName: p.fullName, title: p.title, photoBase64: p.photoBase64 });
  } else {
    result = await applyDelete({ entryId: entityId, auth });
  }

  if (!result.ok) {
    await markStatus(syncOpRowId, 'failed', result.message);
    return { operationId, status: 'failed', error: result.code, message: result.message };
  }

  await markStatus(syncOpRowId, 'synced');
  await writeAudit({
    userId, deviceId, action: result.action, entityType: 'staff_directory', entityId,
    result: 'success', metadata: result.metadata,
  });
  return { operationId, status: 'synced' };
}

module.exports = { applyCreate, applyUpdate, applyDelete, handleDirectoryOperation, SECTION_CREATORS };

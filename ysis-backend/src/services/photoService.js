const cloudinary = require('cloudinary').v2;
const config = require('../config');
const db = require('../db');
const { Errors } = require('../utils/errors');

let configured = false;
function isCloudinaryConfigured() {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  return !!(cloudName && apiKey && apiSecret);
}
function ensureCloudinaryConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
  configured = true;
}

/**
 * TEMPORARY FALLBACK: when Cloudinary credentials aren't set in the
 * environment yet, store the image inline as a data: URI in the
 * `photo_url` TEXT column instead of failing the request. This keeps
 * the feature usable during development. Swap this out (delete the
 * `if` block below) once CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET
 * are set — inline data URIs bloat the DB and don't belong long-term,
 * especially for student passport photos.
 */
function uploadBase64Image(base64Data, publicId) {
  if (!isCloudinaryConfigured()) {
    return Promise.resolve(`data:image/jpeg;base64,${base64Data}`);
  }
  ensureCloudinaryConfigured();
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      `data:image/jpeg;base64,${base64Data}`,
      { public_id: publicId, folder: 'ysis/passport-photos', overwrite: false },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result.secure_url);
      }
    );
  });
}

/**
 * Uploads a student's passport photo, enforcing the locked rule from
 * Build Spec Section 7: exactly ONE current photo per student,
 * permanent once uploaded. A Head Teacher uploading when a photo
 * already exists is rejected outright. Only a Principal/Director may
 * replace an existing photo, and only with a `correctionReason` — this
 * mirrors the mandatory-reason pattern used for permission delegation.
 */
async function uploadStudentPhoto({ studentId, uploaderId, uploaderRole, deviceId, imageBase64, correctionReason }) {
  const existing = await db.query(
    'SELECT id FROM student_photos WHERE student_id = $1 AND is_current = TRUE',
    [studentId]
  );
  const hasExisting = existing.rows.length > 0;
  const isAdmin = uploaderRole === 'principal' || uploaderRole === 'director';

  if (hasExisting && !isAdmin) {
    throw Errors.conflict(
      'PHOTO_ALREADY_EXISTS',
      'This student already has a passport photo on file. Ask your Principal if it needs to be corrected.'
    );
  }
  if (hasExisting && isAdmin && !correctionReason) {
    throw Errors.badRequest(
      'CORRECTION_REASON_REQUIRED',
      'Please provide a reason for replacing this photo.'
    );
  }

  const publicId = `student-${studentId}-${Date.now()}`;
  const secureUrl = await uploadBase64Image(imageBase64, publicId);

  return db.withTransaction(async (client) => {
    if (hasExisting) {
      await client.query(
        'UPDATE student_photos SET is_current = FALSE WHERE student_id = $1 AND is_current = TRUE',
        [studentId]
      );
    }

    const { rows } = await client.query(
      `INSERT INTO student_photos
         (student_id, storage_url, uploaded_by, uploaded_device_id, is_current, approved_by, correction_reason)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6)
       RETURNING *`,
      [studentId, secureUrl, uploaderId, deviceId, hasExisting ? uploaderId : null, hasExisting ? correctionReason : null]
    );

    return rows[0];
  });
}

/**
 * Uploads a photo for a staff directory card (board / management / class
 * teacher). Directory cards are display-only — there's no "current photo"
 * lock like students have, so this is a plain upload-and-return-URL, no
 * transaction, no isCurrent bookkeeping.
 */
async function uploadDirectoryPhoto(imageBase64, entryId) {
  const publicId = `directory-${entryId}-${Date.now()}`;
  return uploadBase64Image(imageBase64, publicId);
}

module.exports = { uploadStudentPhoto, uploadDirectoryPhoto };

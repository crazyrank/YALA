const cloudinary = require('cloudinary').v2;
const config = require('../config');
const db = require('../db');
const { Errors } = require('../utils/errors');

function ensureCloudinary() {
  if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
    throw Errors.badRequest(
      'PHOTO_STORAGE_UNAVAILABLE',
      'Photo storage is not configured. Contact the administrator.'
    );
  }
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

/** Reject non-JPEG / oversized payloads before they hit Cloudinary. */
function assertValidImageBase64(imageBase64) {
  if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    throw Errors.badRequest('INVALID_PHOTO', 'Photo data is missing or too small.');
  }
  // Cap about 1.5MB base64 (about 1MB binary). Passport photos are compressed to 30-60KB on the phone.
  if (imageBase64.length > 1.5 * 1024 * 1024) {
    throw Errors.badRequest('INVALID_PHOTO', 'Photo is too large. Re-capture and try again.');
  }
  // Strip data-URL prefix if present
  const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  let buf;
  try {
    buf = Buffer.from(raw, 'base64');
  } catch {
    throw Errors.badRequest('INVALID_PHOTO', 'Photo data is not valid base64.');
  }
  // JPEG magic bytes FF D8 FF
  if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    throw Errors.badRequest('INVALID_PHOTO', 'Only JPEG passport photos are accepted.');
  }
  return raw;
}

/**
 * Uploads a JPEG. Student photos pass { authenticated: true }, so Cloudinary
 * will only serve them through signed links. Returns { publicId } for those,
 * and the public secure_url for directory photos.
 */
async function uploadBase64Image(imageBase64, publicId, { authenticated = false } = {}) {
  ensureCloudinary();
  const raw = assertValidImageBase64(imageBase64);
  const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${raw}`, {
    public_id: publicId,
    folder: 'ysis',
    resource_type: 'image',
    overwrite: true,
    format: 'jpg',
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    ...(authenticated ? { type: 'authenticated' } : {}),
  });
  return authenticated ? { publicId: result.public_id } : result.secure_url;
}

/**
 * Signed link to a private student photo. Only call this after the caller's
 * scope has been checked. The link is signed but does not expire yet.
 */
function signedStudentPhotoUrl(publicId) {
  ensureCloudinary();
  return cloudinary.url(publicId, {
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format: 'jpg',
  });
}

async function uploadStudentPhoto({
  studentId,
  imageBase64,
  uploaderId,
  deviceId,
  correctionReason = null,
}) {
  return db.withTransaction(async (client) => {
    const { rows: existing } = await client.query(
      'SELECT id FROM student_photos WHERE student_id = $1 AND is_current = TRUE',
      [studentId]
    );
    const hasExisting = existing.length > 0;

    if (hasExisting && !correctionReason) {
      throw Errors.forbidden('Only a Principal can replace an existing passport photo (reason required).');
    }

    if (hasExisting) {
      await client.query(
        'UPDATE student_photos SET is_current = FALSE WHERE student_id = $1 AND is_current = TRUE',
        [studentId]
      );
    }

    const publicId = `student-${studentId}-${Date.now()}`;
    const uploaded = await uploadBase64Image(imageBase64, publicId, { authenticated: true });

    // storage_url holds the Cloudinary file ID for private photos, not a link.
    const { rows } = await client.query(
      `INSERT INTO student_photos
         (student_id, storage_url, cloudinary_public_id, uploaded_by, uploaded_from_device_id,
          is_current, corrected_by, correction_reason)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)
       RETURNING *`,
      [
        studentId,
        uploaded.publicId,
        uploaded.publicId,
        uploaderId,
        deviceId,
        hasExisting ? uploaderId : null,
        hasExisting ? correctionReason : null,
      ]
    );

    return rows[0];
  });
}

async function uploadDirectoryPhoto(imageBase64, entryId) {
  const publicId = `directory-${entryId}-${Date.now()}`;
  return uploadBase64Image(imageBase64, publicId);
}

module.exports = { uploadStudentPhoto, uploadDirectoryPhoto, signedStudentPhotoUrl };

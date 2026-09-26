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
  // Cap \~1.5MB base64 (\~1MB binary) — passport photos are compressed to 30-60KB client-side
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

async function uploadBase64Image(imageBase64, publicId) {
  ensureCloudinary();
  const raw = assertValidImageBase64(imageBase64);
  const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${raw}`, {
    public_id: publicId,
    folder: 'ysis',
    resource_type: 'image',
    overwrite: true,
    format: 'jpg',
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  });
  return result.secure_url;
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

    const publicId = `student-\( {studentId}- \){Date.now()}`;
    const secureUrl = await uploadBase64Image(imageBase64, publicId);

    const { rows } = await client.query(
      `INSERT INTO student_photos
         (student_id, storage_url, uploaded_by, uploaded_from_device_id, is_current,
          corrected_by, correction_reason)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6)
       RETURNING *`,
      [
        studentId,
        secureUrl,
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
  const publicId = `directory-\( {entryId}- \){Date.now()}`;
  return uploadBase64Image(imageBase64, publicId);
}

module.exports = { uploadStudentPhoto, uploadDirectoryPhoto };

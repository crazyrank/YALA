const cloudinary = require('cloudinary').v2;
const config = require('../config');
const db = require('../db');
const { Errors } = require('../utils/errors');

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function validateImageBase64(base64Data) {
  if (typeof base64Data !== 'string' || base64Data.length === 0) {
    throw Errors.badRequest('INVALID_IMAGE', 'No image data was provided.');
  }

  const raw = base64Data.startsWith('data:')
    ? base64Data.slice(base64Data.indexOf(',') + 1)
    : base64Data;

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    throw Errors.badRequest('INVALID_IMAGE', 'Image data is not valid base64.');
  }

  let buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch (e) {
    throw Errors.badRequest('INVALID_IMAGE', 'Image data could not be decoded.');
  }

  if (buffer.length === 0) {
    throw Errors.badRequest('INVALID_IMAGE', 'Decoded image data is empty.');
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw Errors.badRequest('IMAGE_TOO_LARGE', 'Image exceeds the 2MB size limit.');
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length > 3 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

  if (!isJpeg && !isPng) {
    throw Errors.badRequest('INVALID_IMAGE', 'Only JPEG or PNG images are accepted.');
  }

  return { raw, mimeType: isPng ? 'image/png' : 'image/jpeg' };
}

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

function uploadBase64Image(base64Data, publicId) {
  const { raw, mimeType } = validateImageBase64(base64Data);

  if (!isCloudinaryConfigured()) {
    return Promise.resolve(`data:${mimeType};base64,${raw}`);
  }
  ensureCloudinaryConfigured();
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      `data:${mimeType};base64,${raw}`,
      { public_id: publicId, folder: 'ysis/passport-photos', overwrite: false },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result.secure_url);
      }
    );
  });
}

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

async function uploadDirectoryPhoto(imageBase64, entryId) {
  const publicId = `directory-${entryId}-${Date.now()}`;
  return uploadBase64Image(imageBase64, publicId);
}

module.exports = { uploadStudentPhoto, uploadDirectoryPhoto };

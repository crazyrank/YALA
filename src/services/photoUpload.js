import * as FileSystem from 'expo-file-system';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { queueOperation } from './syncEngine';
import { compressPassportPhoto } from './photo';

/**
 * Full pipeline for a captured passport photo: compress at capture
 * (locked decision, Build Spec Section 7), save the local SQLite row
 * immediately (local-commit-first, Principle 2), then queue a sync
 * operation carrying the compressed image as base64 so it uploads to
 * Cloudinary the moment the device reconnects — no separate "upload
 * pending" step for the user to remember.
 *
 * `isCorrection` + `correctionReason` are only meaningful when a
 * Principal is replacing an existing photo (Build Spec Section 7,
 * locked decision: Head Teachers cannot do this at all — that
 * restriction is enforced server-side in photoService, not just here,
 * but we also block the button in the UI for a Head Teacher as a first line).
 */
export async function saveStudentPhoto({ studentId, rawUri, isCorrection = false, correctionReason = null }) {
  const compressedUri = await compressPassportPhoto(rawUri);
  const imageBase64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const photoId = uuidv4();
  const db = await getDb();

  if (isCorrection) {
    // Mark any existing local "current" photo row as superseded before
    // inserting the new one, mirroring the server-side is_current flip.
    await db.runAsync('UPDATE student_photos SET is_current = 0 WHERE student_id = ?', [studentId]);
  }

  await db.runAsync(
    `INSERT INTO student_photos (id, student_id, local_uri, is_current, uploaded_at, synced)
     VALUES (?, ?, ?, 1, ?, 0)`,
    [photoId, studentId, compressedUri, new Date().toISOString()]
  );

  await queueOperation({
    opType: 'upload_photo',
    entityId: studentId,
    payload: {
      photoId,
      studentId,
      imageBase64,
      ...(isCorrection ? { correctionReason } : {}),
    },
  });

  return compressedUri;
}

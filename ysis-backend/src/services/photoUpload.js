import * as FileSystem from 'expo-file-system';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { queueOperation } from './syncEngine';
import { compressPassportPhoto } from './photo';

/**
 * Local-commit-first photo pipeline.
 * We store ONLY the local file URI in the DB.
 * The base64 is read from disk only at the moment of actual sync.
 */
export async function saveStudentPhoto({
  studentId,
  rawUri,
  isCorrection = false,
  correctionReason = null,
}) {
  const compressedUri = await compressPassportPhoto(rawUri);

  const photoId = uuidv4();
  const db = await getDb();

  if (isCorrection) {
    await db.runAsync(
      'UPDATE student_photos SET is_current = 0 WHERE student_id = ?',
      [studentId]
    );
  }

  await db.runAsync(
    `INSERT INTO student_photos
       (id, student_id, local_uri, is_current, uploaded_at, synced)
     VALUES (?, ?, ?, 1, ?, 0)`,
    [photoId, studentId, compressedUri, new Date().toISOString()]
  );

  // Payload contains only a reference, NOT the image data
  await queueOperation({
    opType: 'upload_photo',
    entityId: studentId,
    payload: {
      photoId,
      studentId,
      localUri: compressedUri,
      ...(isCorrection ? { correctionReason } : {}),
    },
  });

  return compressedUri;
}

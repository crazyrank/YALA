import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDb } from '../db';
import {
  studentToCells,
  buildCsvText,
  countNotReimportable,
  chunk,
  EXPORT_CHUNK_ROWS,
} from './studentCsvFormat';

/**
 * Exports every student stored on this device to CSV files in the exact format
 * the import screen accepts, then opens the share sheet for each file.
 *
 * Reads from local SQLite only (offline-first). A Head Teacher's export holds
 * only their assigned classes, the same as the rest of the app.
 *
 * Returns { count, notImportable, files }:
 *   count:         students exported
 *   notImportable: students whose record is missing a required import value
 *                  (gender, date of birth, session, or arm for SS2/SS3). They
 *                  are still in the file, but the import will skip them.
 *   files:         number of files shared (more than one above 2,000 students)
 */
export async function exportStudentsToCsv() {
  const db = await getDb();

  const rows = await db.getAllAsync(
    `SELECT admission_no, full_name, division, class_level, arm,
            guardian_name, guardian_phone, gender, date_of_birth,
            COALESCE(academic_session, current_session) AS session
       FROM students
      ORDER BY division, class_level, full_name ASC`
  );

  if (!rows || rows.length === 0) {
    return { count: 0, notImportable: 0, files: 0 };
  }

  const cellRows = rows.map(studentToCells);
  const { notImportable } = countNotReimportable(cellRows);

  const canShare = await Sharing.isAvailableAsync();
  const parts = chunk(cellRows, EXPORT_CHUNK_ROWS);
  const timestamp = new Date().toISOString().slice(0, 10);

  let files = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const suffix = parts.length > 1 ? `-part-${i + 1}` : '';
    const fileUri = `${FileSystem.cacheDirectory}yala-students-${timestamp}${suffix}.csv`;

    await FileSystem.writeAsStringAsync(fileUri, buildCsvText(parts[i]), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: parts.length > 1 ? `Export students (part ${i + 1} of ${parts.length})` : 'Export students',
        UTI: 'public.comma-separated-values-text',
      });
    }
    files += 1;
  }

  return { count: rows.length, notImportable, files };
}

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDb } from '../db';

const EXPORT_COLUMNS = [
  { key: 'admission_no', label: 'Admission No' },
  { key: 'full_name', label: 'Full Name' },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'division', label: 'Division' },
  { key: 'class_level', label: 'Class Level' },
  { key: 'arm', label: 'Arm' },
  { key: 'guardian_name', label: 'Guardian Name' },
  { key: 'guardian_phone', label: 'Guardian Phone' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Registered At' },
];

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function buildCsv(rows) {
  const header = EXPORT_COLUMNS.map((c) => escapeCsvValue(c.label)).join(',');

  const lines = rows.map((row) =>
    EXPORT_COLUMNS.map((c) => escapeCsvValue(row[c.key])).join(',')
  );

  return [header, ...lines].join('\n');
}

/**
 * Exports every student currently stored on this device to a CSV file
 * and opens the native share sheet so it can be saved or sent on.
 *
 * Reads from local SQLite only — this is offline-first by design, so
 * the export reflects exactly what has synced to this device. A Head
 * Teacher only ever has their assigned classes synced locally, so the
 * export is naturally scoped the same way the rest of the app already
 * is, with no extra filtering needed here.
 *
 * Returns the number of rows exported, or 0 if there was nothing to
 * export (the caller should show its own "no students" message then).
 */
export async function exportStudentsToCsv() {
  const db = await getDb();

  const rows = await db.getAllAsync(
    `SELECT admission_no, full_name, date_of_birth, gender, division,
            class_level, arm, guardian_name, guardian_phone, status, created_at
     FROM students
     ORDER BY full_name ASC`
  );

  if (!rows || rows.length === 0) {
    return 0;
  }

  const csv = buildCsv(rows);
  const timestamp = new Date().toISOString().slice(0, 10);
  const fileUri = `${FileSystem.cacheDirectory}yala-students-${timestamp}.csv`;

  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export students',
      UTI: 'public.comma-separated-values-text',
    });
  }

  return rows.length;
}

/**
 * The local students table was created with a CHECK that allows only 8 statuses.
 * SQLite cannot change a CHECK in place, so the table is rebuilt once, copying
 * every row. studentsRebuildSql returns the CREATE statement for the replacement
 * table, or null when no rebuild is needed.
 */
export const STUDENT_STATUSES = [
  'registered', 'active', 'promoted', 'graduated',
  'transferred', 'withdrawn', 'expelled', 'archived',
  'inactive', 'deceased', 'not_admitted',
];

const STATUS_CHECK = /CHECK\s*\(\s*status\s+IN\s*\([^)]*\)\s*\)/i;
const CREATE_STUDENTS = /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["`]?students["`]?/i;

export function studentsRebuildSql(existingSql) {
  if (!existingSql) return null;
  if (existingSql.includes("'not_admitted'")) return null; // already current
  if (!STATUS_CHECK.test(existingSql) || !CREATE_STUDENTS.test(existingSql)) return null; // unknown shape: leave alone
  const check = `CHECK (status IN (${STUDENT_STATUSES.map((s) => `'${s}'`).join(',')}))`;
  return existingSql
    .replace(CREATE_STUDENTS, 'CREATE TABLE students_rebuild')
    .replace(STATUS_CHECK, check);
}

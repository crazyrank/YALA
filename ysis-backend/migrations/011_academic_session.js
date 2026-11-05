// Academic session per student record, for example "2026/2027".
// Sessions run from September to August, read in Lagos time (UTC+1).
// Existing records are filled in from their registration date with the same rule.
exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_session TEXT;`);
  pgm.sql(`
    UPDATE students
    SET academic_session = CASE
      WHEN EXTRACT(MONTH FROM created_at AT TIME ZONE 'Africa/Lagos') >= 9
        THEN EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Lagos')::int
             || '/' || (EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Lagos')::int + 1)
      ELSE (EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Lagos')::int - 1)
             || '/' || EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Lagos')::int
    END
    WHERE academic_session IS NULL;
  `);
  pgm.sql(`
    ALTER TABLE students
      ADD CONSTRAINT students_academic_session_format
      CHECK (academic_session IS NULL OR academic_session ~ '^[0-9]{4}/[0-9]{4}$');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_academic_session_format;`);
  pgm.sql(`ALTER TABLE students DROP COLUMN IF EXISTS academic_session;`);
};

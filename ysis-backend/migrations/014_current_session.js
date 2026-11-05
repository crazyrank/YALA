// Current academic session per student. Starts equal to the registered
// academic_session and advances one year on every successful promotion.
// Registered session (academic_session) never changes after creation.

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE students ADD COLUMN IF NOT EXISTS current_session TEXT;`);
  // Backfill: existing students get current_session = academic_session
  pgm.sql(`
    UPDATE students
    SET current_session = academic_session
    WHERE current_session IS NULL AND academic_session IS NOT NULL;
  `);
  pgm.sql(`
    ALTER TABLE students
      DROP CONSTRAINT IF EXISTS students_current_session_format;
  `);
  pgm.sql(`
    ALTER TABLE students
      ADD CONSTRAINT students_current_session_format
      CHECK (current_session IS NULL OR current_session ~ '^[0-9]{4}/[0-9]{4}$');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_current_session_format;`);
  pgm.sql(`ALTER TABLE students DROP COLUMN IF EXISTS current_session;`);
};

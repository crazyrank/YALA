// Registered term of each student (First, Second or Third). Set once at
// registration and never changed by promotion. Existing students stay blank.
exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE students ADD COLUMN IF NOT EXISTS registered_term TEXT;`);
  pgm.sql(`
    ALTER TABLE students
      DROP CONSTRAINT IF EXISTS students_registered_term_values,
      ADD CONSTRAINT students_registered_term_values
      CHECK (registered_term IS NULL OR registered_term IN ('First', 'Second', 'Third'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_registered_term_values;`);
  pgm.sql(`ALTER TABLE students DROP COLUMN IF EXISTS registered_term;`);
};

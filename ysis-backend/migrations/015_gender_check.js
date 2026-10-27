// Database-level guard for student gender. The application already accepts
// only M, F or NULL (studentRules.js, GENDERS). This enforces the same rule
// in Postgres, so no other code path can store a different value.
//
// NOT VALID adds the check without scanning rows first. VALIDATE then scans
// every existing row and fails the migration if any row breaks the rule.

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_gender_values;`);
  pgm.sql(`
    ALTER TABLE students
      ADD CONSTRAINT students_gender_values
      CHECK (gender IS NULL OR gender IN ('M', 'F')) NOT VALID;
  `);
  pgm.sql(`ALTER TABLE students VALIDATE CONSTRAINT students_gender_values;`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_gender_values;`);
};

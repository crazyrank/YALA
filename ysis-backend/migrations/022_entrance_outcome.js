/* Records the common entrance outcome for Primary 5 pupils.
   NULL means Result Pending. Only the Principal and Director may set it.
   Additive and nullable, so it is safe on live data. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE students ADD COLUMN IF NOT EXISTS entrance_outcome TEXT;`);
  pgm.sql(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_entrance_outcome_check;`);
  pgm.sql(`ALTER TABLE students ADD CONSTRAINT students_entrance_outcome_check CHECK (entrance_outcome IN ('admitted', 'not_admitted'));`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_entrance_outcome_check;`);
  pgm.sql(`ALTER TABLE students DROP COLUMN IF EXISTS entrance_outcome;`);
};

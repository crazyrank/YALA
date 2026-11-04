/* Step 2b: one class per Class Teacher.
   The primary key on user_id is what enforces "one class per Class Teacher". */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS class_teacher_assignments (
      user_id UUID PRIMARY KEY REFERENCES users(id),
      division TEXT NOT NULL CHECK (division IN ('primary', 'secondary')),
      class_level TEXT NOT NULL,
      arm TEXT,
      assigned_by UUID REFERENCES users(id),
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS class_teacher_assignments;`);
};

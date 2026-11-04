/* Leave model. Adds the statuses the spec needs and a record of each leave.
   Enum values cannot be added inside a transaction on every Postgres version,
   so this migration runs without one. Every statement is safe to re-run. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.noTransaction();

  pgm.sql(`ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'inactive';`);
  pgm.sql(`ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'deceased';`);
  pgm.sql(`ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'not_admitted';`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS student_leaves (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id   UUID NOT NULL REFERENCES students(id),
      leave_type   TEXT NOT NULL CHECK (leave_type IN
                     ('graduated','transferred','withdrawn','expelled','deceased','not_admitted')),
      leave_session TEXT NOT NULL,
      reason       TEXT,
      recorded_by  UUID NOT NULL REFERENCES users(id),
      recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS student_leaves_session_type_idx ON student_leaves (leave_session, leave_type);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS student_leaves_student_idx ON student_leaves (student_id);`);
};

exports.down = (pgm) => {
  // Enum values cannot be removed from a Postgres type, so only the table goes.
  pgm.sql(`DROP TABLE IF EXISTS student_leaves;`);
};

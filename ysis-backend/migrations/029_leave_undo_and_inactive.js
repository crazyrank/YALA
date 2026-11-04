/* Step 4e: undo a leave, and the Inactive status.
   previous_status lets an undo put the student back exactly where they were.
   Undone leaves stay in student_leaves with undone_at set. Nothing is deleted.
   student_status_events records every Inactive change and every undo. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE student_leaves
      ADD COLUMN IF NOT EXISTS previous_status TEXT,
      ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS undone_by UUID REFERENCES users(id);
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS student_status_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES students(id),
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      reason TEXT,
      changed_by UUID NOT NULL REFERENCES users(id),
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS student_status_events_student_idx ON student_status_events (student_id, changed_at DESC);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS student_status_events_student_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS student_status_events;`);
  pgm.sql(`ALTER TABLE student_leaves DROP COLUMN IF EXISTS undone_by, DROP COLUMN IF EXISTS undone_at, DROP COLUMN IF EXISTS previous_status;`);
};

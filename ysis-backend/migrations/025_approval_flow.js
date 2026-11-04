/* Step 2a: approval flow foundation.
   - adds the class_teacher role
   - adds the registration approval columns to students
   Existing students default to 'approved', so nothing changes for current data.
   Runs without a transaction because enum values cannot always be added inside one.
   Every statement is safe to re-run. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.noTransaction();

  pgm.sql(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'class_teacher';`);

  pgm.sql(`ALTER TABLE students ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';`);
  pgm.sql(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_approval_status_check;`);
  pgm.sql(`ALTER TABLE students ADD CONSTRAINT students_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'returned'));`);
  pgm.sql(`ALTER TABLE students ADD COLUMN IF NOT EXISTS return_reason TEXT;`);
  pgm.sql(`ALTER TABLE students ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);`);
  pgm.sql(`ALTER TABLE students ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS students_awaiting_approval_idx ON students (division, class_level) WHERE approval_status <> 'approved';`);
};

exports.down = (pgm) => {
  // The enum value cannot be removed from a Postgres type, so only the columns go.
  pgm.sql(`DROP INDEX IF EXISTS students_awaiting_approval_idx;`);
  pgm.sql(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_approval_status_check;`);
  pgm.sql(`ALTER TABLE students DROP COLUMN IF EXISTS approved_at;`);
  pgm.sql(`ALTER TABLE students DROP COLUMN IF EXISTS approved_by;`);
  pgm.sql(`ALTER TABLE students DROP COLUMN IF EXISTS return_reason;`);
  pgm.sql(`ALTER TABLE students DROP COLUMN IF EXISTS approval_status;`);
};

/* Biodata approval and sync support. Works like registration approval:
   - a Class Teacher's save is Pending until the Head Teacher (or Principal or Director) approves it
   - a returned record goes back with a reason
   - version counts every change, so phones can tell what is newer
   Existing rows default to 'approved', so nothing changes for current data.
   Every statement is safe to re-run. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE student_biodata ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';`);
  pgm.sql(`ALTER TABLE student_biodata DROP CONSTRAINT IF EXISTS student_biodata_approval_status_check;`);
  pgm.sql(`ALTER TABLE student_biodata ADD CONSTRAINT student_biodata_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'returned'));`);
  pgm.sql(`ALTER TABLE student_biodata ADD COLUMN IF NOT EXISTS return_reason TEXT;`);
  pgm.sql(`ALTER TABLE student_biodata ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);`);
  pgm.sql(`ALTER TABLE student_biodata ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);`);
  pgm.sql(`ALTER TABLE student_biodata ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;`);
  pgm.sql(`ALTER TABLE student_biodata ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;`);
  // Phones pull changes in (updated_at, student_id) order, the same way student changes are pulled.
  pgm.sql(`CREATE INDEX IF NOT EXISTS student_biodata_changes_idx ON student_biodata (updated_at, student_id);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS student_biodata_awaiting_idx ON student_biodata (student_id) WHERE approval_status <> 'approved';`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS student_biodata_awaiting_idx;`);
  pgm.sql(`DROP INDEX IF EXISTS student_biodata_changes_idx;`);
  pgm.sql(`ALTER TABLE student_biodata DROP CONSTRAINT IF EXISTS student_biodata_approval_status_check;`);
  pgm.sql(`ALTER TABLE student_biodata DROP COLUMN IF EXISTS version;`);
  pgm.sql(`ALTER TABLE student_biodata DROP COLUMN IF EXISTS approved_at;`);
  pgm.sql(`ALTER TABLE student_biodata DROP COLUMN IF EXISTS approved_by;`);
  pgm.sql(`ALTER TABLE student_biodata DROP COLUMN IF EXISTS submitted_by;`);
  pgm.sql(`ALTER TABLE student_biodata DROP COLUMN IF EXISTS return_reason;`);
  pgm.sql(`ALTER TABLE student_biodata DROP COLUMN IF EXISTS approval_status;`);
};

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS guest_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS guest_reason TEXT;
    ALTER TABLE users ADD CONSTRAINT users_guest_expiry_check
      CHECK ((role = 'guest' AND guest_expires_at IS NOT NULL AND guest_reason IS NOT NULL)
          OR (role <> 'guest' AND guest_expires_at IS NULL AND guest_reason IS NULL));
    CREATE INDEX IF NOT EXISTS idx_users_guest_expiry ON users (guest_expires_at) WHERE role = 'guest';
    CREATE TABLE IF NOT EXISTS guest_student_access (
      guest_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      granted_by UUID NOT NULL REFERENCES users(id),
      granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (guest_user_id, student_id)
    );
    CREATE INDEX IF NOT EXISTS idx_guest_student_access_student ON guest_student_access(student_id);
  `);
};
exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS guest_student_access; DROP INDEX IF EXISTS idx_users_guest_expiry; ALTER TABLE users DROP CONSTRAINT IF EXISTS users_guest_expiry_check; ALTER TABLE users DROP COLUMN IF EXISTS guest_expires_at, DROP COLUMN IF EXISTS guest_reason;`);
};

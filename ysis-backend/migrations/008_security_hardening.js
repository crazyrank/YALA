/**
 * Security hardening migration.
 * - failed_login_count / locked_until for progressive lockout
 * - refresh_token_hash on devices so logout can invalidate the specific session
 * without killing every device (preserves multi-device + session_version design)
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
  `);

  pgm.sql(`
    ALTER TABLE devices
      ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_users_locked_until
      ON users (locked_until)
      WHERE locked_until IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_users_locked_until;`);
  pgm.sql(`ALTER TABLE devices DROP COLUMN IF EXISTS refresh_token_hash;`);
  pgm.sql(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS failed_login_count,
      DROP COLUMN IF EXISTS locked_until;
  `);
};

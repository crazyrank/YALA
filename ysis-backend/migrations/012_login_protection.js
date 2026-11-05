// Login protection: failed-attempt counters, pair locks, and IP blocks.
// Stores a hash of the email, never the email itself. IP history is removed
// after 30 days by the cleanup job in src/services/loginProtection.js.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id            BIGSERIAL PRIMARY KEY,
      email_hash    TEXT NOT NULL,
      ip            TEXT NOT NULL,
      succeeded     BOOLEAN NOT NULL DEFAULT false,
      attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_login_attempts_pair ON login_attempts (email_hash, ip, attempted_at);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip, attempted_at);`);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS login_pair_locks (
      pair_key      TEXT PRIMARY KEY,
      locked_until  TIMESTAMPTZ NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS ip_blocks (
      ip             TEXT PRIMARY KEY,
      blocked_until  TIMESTAMPTZ NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      unblocked_by   UUID REFERENCES users(id),
      unblocked_at   TIMESTAMPTZ
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS ip_blocks;`);
  pgm.sql(`DROP TABLE IF EXISTS login_pair_locks;`);
  pgm.sql(`DROP TABLE IF EXISTS login_attempts;`);
};

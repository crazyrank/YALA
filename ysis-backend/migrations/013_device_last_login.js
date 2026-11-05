// Records each device's last successful sign-in IP and time, shown on the device screen.
// Only the IP is kept. No location is stored.
exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_login_ip TEXT;`);
  pgm.sql(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE devices DROP COLUMN IF EXISTS last_login_at;`);
  pgm.sql(`ALTER TABLE devices DROP COLUMN IF EXISTS last_login_ip;`);
};

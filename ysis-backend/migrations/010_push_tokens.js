exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS push_token TEXT;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_devices_push_token ON devices (push_token) WHERE push_token IS NOT NULL;`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_devices_push_token;`);
  pgm.sql(`ALTER TABLE devices DROP COLUMN IF EXISTS push_token;`);
};

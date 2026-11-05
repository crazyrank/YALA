/* Slice 2e: versioned staff profile edits through the offline sync queue. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_version integer NOT NULL DEFAULT 1;`);
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'staff_profile_update';`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS profile_version;`);
  // PostgreSQL enum values cannot be removed safely.
};

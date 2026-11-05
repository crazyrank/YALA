/* Slice 2d: lets the phone queue staff directory changes. Requires migration 035.
   Postgres enum values cannot be removed, so down() is empty. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'directory_create';`);
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'directory_update';`);
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'directory_delete';`);
};

exports.down = () => {
  // Intentionally empty: Postgres cannot drop enum values.
};

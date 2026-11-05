/* Slice 2a: lets the phone queue biodata saves and head teacher approve/return
   decisions. Postgres enum values cannot be removed, so down() leaves them in place.
   Requires migration 032 (approval columns) to be applied first. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'biodata_save';`);
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'biodata_review';`);
};

exports.down = () => {
  // Intentionally empty: Postgres cannot drop enum values. Unused values are harmless.
};

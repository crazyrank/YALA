/* Slice 2b: lets the phone queue log book writes. Requires migration 033 first.
   Postgres enum values cannot be removed, so down() leaves them in place. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'log_entry_create';`);
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'log_entry_edit';`);
};

exports.down = () => {
  // Intentionally empty: Postgres cannot drop enum values.
};

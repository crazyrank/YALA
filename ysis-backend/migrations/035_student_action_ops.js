/* Slice 2c: lets the phone queue leave, entrance outcome and inactive / clear-inactive.
   Requires migration 034. Postgres enum values cannot be removed, so down() is empty. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'student_leave';`);
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'entrance_outcome';`);
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE IF NOT EXISTS 'student_status_change';`);
};

exports.down = () => {
  // Intentionally empty: Postgres cannot drop enum values.
};

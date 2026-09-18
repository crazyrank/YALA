exports.up = (pgm) => {
  // Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction on
  // Postgres < 12. If this migration fails with that error, run the SQL
  // below manually via psql instead, then mark this migration as applied.
  pgm.sql(`ALTER TYPE sync_op_type ADD VALUE 'archive_student';`);
};

exports.down = (pgm) => {
  // Postgres does not support removing a single enum value. Rolling this
  // back requires recreating the sync_op_type enum from scratch, which is
  // intentionally not automated here to avoid data loss on any existing
  // 'archive_student' rows in sync_operations.
};

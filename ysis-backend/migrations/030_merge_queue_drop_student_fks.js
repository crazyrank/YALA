/* Merge queue rows must outlive the discarded student record.
   Their student ids become plain history once the duplicate is hard-deleted. */
exports.shorthands = undefined;

const COLS = ['record_a_id', 'record_b_id', 'canonical_id', 'discarded_id'];

exports.up = (pgm) => {
  COLS.forEach((c) => {
    pgm.sql(`ALTER TABLE admission_merge_queue DROP CONSTRAINT IF EXISTS admission_merge_queue_${c}_fkey;`);
  });
};

exports.down = (pgm) => {
  COLS.forEach((c) => {
    pgm.sql(`ALTER TABLE admission_merge_queue ADD CONSTRAINT admission_merge_queue_${c}_fkey FOREIGN KEY (${c}) REFERENCES students(id) NOT VALID;`);
  });
};

/* Primary 6 is removed from the class list. Students still labelled
   Primary 6 are marked Graduated from Primary School.
   Run only after a backup and after checking the count (see report). */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`UPDATE students SET status = 'graduated' WHERE class_level = 'Primary 6' AND status NOT IN ('graduated', 'transferred', 'withdrawn', 'expelled', 'archived');`);
};

exports.down = () => {
  // Not reversed automatically. Restore from the backup if needed.
};

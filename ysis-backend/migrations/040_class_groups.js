/* Class groups: SS1 Science can have two class teachers.
   Students get a group label (Science 1 or Science 2), and so does the
   teacher assignment. NULL means the whole arm or section. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE students ADD COLUMN IF NOT EXISTS group_label TEXT;`);
  pgm.sql(`ALTER TABLE class_teacher_assignments ADD COLUMN IF NOT EXISTS group_label TEXT;`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE class_teacher_assignments DROP COLUMN IF EXISTS group_label;`);
  pgm.sql(`ALTER TABLE students DROP COLUMN IF EXISTS group_label;`);
};

/* eslint-disable camelcase */

exports.shorthands = undefined;

// A head teacher may be assigned a whole division (Primary or Secondary)
// with no class level. Rows with a class level are unchanged.
exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE head_teacher_class_assignments ALTER COLUMN class_level DROP NOT NULL;`);
};

exports.down = (pgm) => {
  pgm.sql(`DELETE FROM head_teacher_class_assignments WHERE class_level IS NULL;`);
  pgm.sql(`ALTER TABLE head_teacher_class_assignments ALTER COLUMN class_level SET NOT NULL;`);
};

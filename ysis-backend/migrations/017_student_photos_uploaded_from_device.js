exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE student_photos ADD COLUMN IF NOT EXISTS uploaded_from_device_id UUID REFERENCES devices(id);`);
  pgm.sql(`ALTER TABLE student_photos ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES users(id);`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE student_photos DROP COLUMN IF EXISTS corrected_by;`);
  pgm.sql(`ALTER TABLE student_photos DROP COLUMN IF EXISTS uploaded_from_device_id;`);
};

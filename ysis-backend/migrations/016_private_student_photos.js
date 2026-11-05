// Stores the Cloudinary file ID for each student photo. Old rows keep their
// public link and get a NULL here, so they keep working until they are moved.

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE student_photos ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE student_photos DROP COLUMN IF EXISTS cloudinary_public_id;`);
};

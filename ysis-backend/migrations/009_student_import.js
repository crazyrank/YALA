/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // One row per import. Stores counts and a report of skipped rows.
  // The report holds row numbers, column names, and reasons only. Never student values.
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS student_import_batches (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_key      UUID NOT NULL UNIQUE,
      uploaded_by     UUID NOT NULL REFERENCES users(id),
      status          TEXT NOT NULL CHECK (status IN ('processing','completed','failed')),
      submitted_rows  INT NOT NULL DEFAULT 0,
      imported_count  INT NOT NULL DEFAULT 0,
      skipped_count   INT NOT NULL DEFAULT 0,
      report          JSONB NOT NULL DEFAULT '[]'::jsonb,
      error_code      TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at    TIMESTAMPTZ
    );
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_student_import_batches_uploader
      ON student_import_batches (uploaded_by);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS student_import_batches;`);
};

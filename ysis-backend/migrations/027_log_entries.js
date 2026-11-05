/* Step 3: Log Book. One row per entry. Entries are never deleted.
   original_body keeps the first text, so a correction never loses what was written. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS log_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      division TEXT NOT NULL CHECK (division IN ('primary', 'secondary')),
      class_level TEXT NOT NULL,
      arm TEXT,
      entry_date DATE NOT NULL,
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
      original_body TEXT,
      written_by UUID NOT NULL REFERENCES users(id),
      written_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      corrected_at TIMESTAMPTZ,
      correction_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS log_entries_class_date_idx ON log_entries (division, class_level, entry_date DESC);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS log_entries_class_date_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS log_entries;`);
};

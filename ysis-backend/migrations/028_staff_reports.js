/* Step 4a: Staff Reports. One report per staff member per month.
   original_comment keeps the first text, so a correction never loses what was written.
   Nothing is deleted. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS staff_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subject_id UUID NOT NULL REFERENCES users(id),
      subject_division TEXT,
      report_month TEXT NOT NULL CHECK (report_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
      score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
      comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 1000),
      original_comment TEXT,
      recognition TEXT NOT NULL DEFAULT 'none'
        CHECK (recognition IN ('none', 'teacher_of_the_month', 'teacher_of_the_year')),
      written_by UUID NOT NULL REFERENCES users(id),
      written_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      corrected_at TIMESTAMPTZ,
      correction_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT staff_reports_one_per_month UNIQUE (subject_id, report_month)
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS staff_reports_month_idx ON staff_reports (report_month);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS staff_reports_month_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS staff_reports;`);
};

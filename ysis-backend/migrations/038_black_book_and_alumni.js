/* Black Book (Principal only) and Alumni records (admins only).
   Nothing is deleted. Black Book corrections keep the first text. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS black_book_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Lagos')::date),
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
      original_body TEXT,
      written_by UUID NOT NULL REFERENCES users(id),
      written_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      corrected_at TIMESTAMPTZ,
      correction_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS alumni_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
      graduation_session TEXT,
      last_class_level TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      contact_status TEXT NOT NULL DEFAULT 'contactable'
        CHECK (contact_status IN ('contactable', 'opted_out', 'deceased')),
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by UUID REFERENCES users(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS alumni_records_status_idx ON alumni_records (contact_status);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS alumni_records_status_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS alumni_records;`);
  pgm.sql(`DROP TABLE IF EXISTS black_book_entries;`);
};

/* Biodata v1. One optional row per student, kept apart from the students table so
   sync, conflict detection and every student list stay untouched.
   Health and emergency fields are staff only. No Guest route reads this table. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS student_biodata (
      student_id                      UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      father_name                     TEXT,
      mother_name                     TEXT,
      guardian_relationship           TEXT,
      home_address                    TEXT,
      alt_phone                       TEXT,
      religion                        TEXT,
      nationality                     TEXT DEFAULT 'Nigerian',
      admission_date                  DATE,
      previous_school                 TEXT,
      last_class_studied              TEXT,
      state_of_origin                 TEXT,
      lga_of_origin                   TEXT,
      town_or_village                 TEXT,
      has_birth_certificate           BOOLEAN,
      emergency_contact_name          TEXT,
      emergency_contact_phone         TEXT,
      emergency_contact_relationship  TEXT,
      allergies_conditions            TEXT,
      living_with                     TEXT CHECK (living_with IS NULL OR living_with IN ('both_parents','one_parent','guardian')),
      created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by                      UUID REFERENCES users(id)
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS student_biodata;`);
};

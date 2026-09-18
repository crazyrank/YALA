/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // NOTE: students.id has NO DEFAULT. The Expo app generates the UUID
  // client-side at creation time, offline or online. This guarantees the
  // same student has the same ID everywhere, since the ID must exist
  // before the record ever reaches the server. Never add a default here.
  pgm.sql(`
    CREATE TABLE students (
      id              UUID PRIMARY KEY,
      admission_no    TEXT UNIQUE NOT NULL,
      full_name       TEXT NOT NULL,
      date_of_birth   DATE,
      gender          TEXT,
      division        division_type NOT NULL,
      class_level     TEXT NOT NULL,
      arm             TEXT,
      guardian_name   TEXT,
      guardian_phone  TEXT,
      status          student_status NOT NULL DEFAULT 'registered',
      sync_version    INT NOT NULL DEFAULT 1,
      registered_by   UUID NOT NULL REFERENCES users(id),
      registered_device_id UUID REFERENCES devices(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      archived_at     TIMESTAMPTZ,
      eligible_for_deletion_at TIMESTAMPTZ
    );
  `);
  pgm.sql(`CREATE INDEX idx_students_search_trgm ON students USING gin (full_name gin_trgm_ops);`);
  pgm.sql(`CREATE INDEX idx_students_class_scope ON students (division, class_level, arm);`);

  pgm.sql(`
    CREATE TABLE student_photos (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id         UUID NOT NULL REFERENCES students(id),
      storage_url        TEXT NOT NULL,
      uploaded_by        UUID NOT NULL REFERENCES users(id),
      uploaded_device_id UUID REFERENCES devices(id),
      is_current         BOOLEAN NOT NULL DEFAULT TRUE,
      approved_by        UUID REFERENCES users(id),
      correction_reason  TEXT,
      uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX idx_student_photos_one_current
      ON student_photos (student_id) WHERE is_current = TRUE;
  `);

  pgm.sql(`
    CREATE TABLE admission_merge_queue (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_no   TEXT NOT NULL,
      record_a_id    UUID NOT NULL REFERENCES students(id),
      record_b_id    UUID NOT NULL REFERENCES students(id),
      status         merge_status NOT NULL DEFAULT 'open',
      resolved_by    UUID REFERENCES users(id),
      canonical_id   UUID REFERENCES students(id),
      discarded_id   UUID REFERENCES students(id),
      resolved_at    TIMESTAMPTZ,
      detected_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`
    CREATE INDEX idx_merge_queue_open ON admission_merge_queue (status) WHERE status = 'open';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS admission_merge_queue;`);
  pgm.sql(`DROP TABLE IF EXISTS student_photos;`);
  pgm.sql(`DROP TABLE IF EXISTS students;`);
};

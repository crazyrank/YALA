/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Board of Directors / Management Team / Class Teachers — the three
  // sections on the one-screen staff slide (Staff & Directory spec,
  // Section 2). Distinct from `user_role`, which governs app LOGINS —
  // a directory entry never implies an account.
  pgm.sql(`CREATE TYPE directory_section AS ENUM ('board', 'management', 'class_teacher');`);

  pgm.sql(`
    CREATE TABLE staff_directory (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      section         directory_section NOT NULL,
      full_name       TEXT NOT NULL,
      title           TEXT NOT NULL,
      photo_url       TEXT,
      linked_user_id  UUID REFERENCES users(id),
      created_by      UUID NOT NULL REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE INDEX idx_staff_directory_section
      ON staff_directory (section, created_at ASC);
  `);

  // A login account (Principal/Head Teacher) gets AT MOST one auto card
  // (Section 5 — auto link). This is the DB-level guarantee that a retried
  // account-creation request can never double-insert a card.
  pgm.sql(`
    CREATE UNIQUE INDEX idx_staff_directory_linked_user
      ON staff_directory (linked_user_id)
      WHERE linked_user_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS staff_directory;`);
  pgm.sql(`DROP TYPE IF EXISTS directory_section;`);
};

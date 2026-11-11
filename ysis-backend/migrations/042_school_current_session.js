// One school-wide current session. Every active student shows this value.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS school_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_session TEXT NOT NULL
        CHECK (current_session ~ '^[0-9]{4}/[0-9]{4}$'),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`
    INSERT INTO school_settings (id, current_session)
    VALUES (1, '2026/2027')
    ON CONFLICT (id) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS school_settings;`);
};

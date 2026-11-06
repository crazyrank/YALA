/* Principal's personal log. Private notebook: one owner, nobody else reads it.
   The id is made on the phone so an entry written offline keeps the same id when it syncs.
   Deleting is a soft delete (deleted_at) so the phone can learn about it on its next sync. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS personal_log_entries (
      id UUID PRIMARY KEY,
      owner_id UUID NOT NULL REFERENCES users(id),
      entry_date DATE NOT NULL,
      title TEXT CHECK (title IS NULL OR char_length(title) <= 120),
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS personal_log_owner_date_idx ON personal_log_entries (owner_id, entry_date DESC) WHERE deleted_at IS NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS personal_log_owner_changes_idx ON personal_log_entries (owner_id, updated_at, id);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS personal_log_owner_changes_idx;`);
  pgm.sql(`DROP INDEX IF EXISTS personal_log_owner_date_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS personal_log_entries;`);
};

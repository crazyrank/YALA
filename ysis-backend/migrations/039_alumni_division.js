/* Alumni records are scoped by division so Head Teachers only see their own. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE alumni_records
      ADD COLUMN IF NOT EXISTS division TEXT
      CHECK (division IN ('primary', 'secondary'));
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS alumni_records_division_idx ON alumni_records (division);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS alumni_records_division_idx;`);
  pgm.sql(`ALTER TABLE alumni_records DROP COLUMN IF EXISTS division;`);
};

exports.up = (pgm) => { pgm.sql(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest';`); };
exports.down = () => { /* PostgreSQL enum values are not removed by this migration. */ };

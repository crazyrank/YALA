/* Migration 021 marked Primary 6 pupils Graduated without bumping
   sync_version or updated_at, so phones never received the change.
   This bumps those rows once so every phone picks them up on its next sync.
   It changes no data values. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`UPDATE students SET sync_version = sync_version + 1, updated_at = now() WHERE class_level = 'Primary 6' AND status = 'graduated';`);
};

exports.down = () => {};

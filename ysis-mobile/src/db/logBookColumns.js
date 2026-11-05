/**
 * Adds the log book columns to log_entries_local on phones that were set up in slice 1.
 * Shared by the local store and the pull, kept in its own file to avoid import cycles.
 */
const COLUMNS = {
  division: 'TEXT',
  class_level: 'TEXT',
  arm: 'TEXT',
  original_body: 'TEXT',
  written_by: 'TEXT',
  written_at: 'TEXT',
  corrected_at: 'TEXT',
  correction_count: 'INTEGER NOT NULL DEFAULT 0',
  written_by_name: 'TEXT',
};

export async function ensureLogColumns(db) {
  const existing = (await db.getAllAsync('PRAGMA table_info(log_entries_local)')).map((c) => c.name);
  for (const [name, type] of Object.entries(COLUMNS)) {
    if (!existing.includes(name)) {
      await db.execAsync(`ALTER TABLE log_entries_local ADD COLUMN ${name} ${type}`);
    }
  }
}

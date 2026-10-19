/**
 * Backup verification. Run against a RESTORED copy of the database, never production.
 *   BACKUP_CHECK_DATABASE_URL=postgresql://... node scripts/backup-check.js
 * Read-only: it runs SELECT queries only.
 */
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const url = process.env.BACKUP_CHECK_DATABASE_URL;
  if (!url) {
    console.error('Set BACKUP_CHECK_DATABASE_URL to the restored copy.');
    process.exit(1);
  }
  if (url === process.env.DATABASE_URL) {
    console.error('Refusing to run: BACKUP_CHECK_DATABASE_URL is the production database.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const problems = [];
  try {
    const count = async (table) => {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
      return rows[0].n;
    };
    const counts = {
      users: await count('users'),
      students: await count('students'),
      devices: await count('devices'),
      audit_logs: await count('audit_logs'),
    };
    console.log('Row counts in restored copy:', counts);

    if (counts.users === 0) problems.push('users table is empty');
    if (counts.students === 0) problems.push('students table is empty');

    const { rows: directors } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE role = 'director'"
    );
    if (directors[0].n === 0) problems.push('no Director account in the restored copy');

    const { rows: latest } = await pool.query('SELECT MAX(created_at) AS latest FROM audit_logs');
    console.log('Latest audit row:', latest[0].latest);
    if (!latest[0].latest) problems.push('audit_logs has no rows');

    console.log('Compare these counts with production before you trust the copy.');
  } finally {
    await pool.end();
  }

  if (problems.length) {
    console.log('\nPROBLEMS:');
    problems.forEach((p) => console.log(' - ' + p));
    process.exit(1);
  }
  console.log('\nBasic checks passed.');
}

main().catch((err) => {
  console.error('Backup check failed:', err.message);
  process.exit(1);
});

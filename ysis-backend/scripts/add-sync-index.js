/**
 * One-time: adds an index to speed up the pending sync queue.
 * Run manually: node scripts/add-sync-index.js
 */
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});
const { pool } = require('../src/db');

async function main() {
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_sync_operations_pending
       ON sync_operations (status, sequence_no)`
  );
  console.log('Index created (or already existed).');

  const { rows } = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'sync_operations'`
  );
  console.log('Indexes on sync_operations:', rows.map((r) => r.indexname).join(', '));
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

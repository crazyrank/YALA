/**
 * One-time cleanup: sync operations that never finished on the server
 * (a crash between saving and processing) stay "pending" forever.
 *
 *   node scripts/clear-stuck-sync-ops.js           count only (dry run)
 *   node scripts/clear-stuck-sync-ops.js --apply   mark them as failed
 *
 * Run it while no device is syncing.
 */
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});
const { pool } = require('../src/db');

const apply = process.argv.includes('--apply');

async function main() {
  const { rows } = await pool.query(
    `SELECT operation_id, op_type, entity_id, sequence_no, created_at_client
     FROM sync_operations
     WHERE status = 'pending' AND processed_at IS NULL
     ORDER BY sequence_no`
  );

  console.log(`Stuck pending operations: ${rows.length}`);
  rows.slice(0, 10).forEach((r) =>
    console.log(`  ${r.op_type}  ${r.entity_id}  ${r.created_at_client}`)
  );

  if (!apply) {
    console.log('Dry run. Re-run with --apply to mark these as failed.');
    return;
  }

  const result = await pool.query(
    `UPDATE sync_operations
     SET status = 'failed',
         error_message = $1,
         processed_at = now()
     WHERE status = 'pending' AND processed_at IS NULL`,
    ['Stopped before it finished on the server. Review before retrying.']
  );
  console.log(`Marked ${result.rowCount} operations as failed.`);
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

require('dotenv').config({ path: '.env.development' });
const db = require('./src/db');

async function main() {
  const { rows } = await db.query(`
    SELECT operation_id, op_type, entity_id, status, error_message,
           created_at_client, processed_at
    FROM sync_operations
    WHERE status != 'synced'
    ORDER BY created_at_client DESC
  `);

  console.log(`Total non-synced operations: ${rows.length}`);
  console.log(JSON.stringify(rows, null, 2));

  const totalStudents = await db.query('SELECT COUNT(*) FROM students');
  console.log('Total students on server:', totalStudents.rows[0].count);

  await db.pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });

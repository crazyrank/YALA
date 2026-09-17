require('dotenv').config({ path: '.env.development' });
const db = require('./src/db');

const suspectIds = [
  '14ecf10e-44e5-462c-ac99-a9d338dab1e3',
  'f92fbd40-144f-46c5-8673-85cd9d36d29c',
  '800d99c1-1ed2-43fb-8ee4-5261c8f4f255',
  'aad26272-c7e2-4635-a536-54ecb2ba070c',
];

async function main() {
  for (const id of suspectIds) {
    const r = await db.query('SELECT id, full_name, admission_no FROM students WHERE id = $1', [id]);
    console.log(id, '=>', r.rows.length ? r.rows[0] : 'DOES NOT EXIST ON SERVER');
  }

  const mq = await db.query('SELECT * FROM admission_merge_queue ORDER BY detected_at DESC');
  console.log('\nmerge queue rows:', JSON.stringify(mq.rows, null, 2));

  await db.pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });

require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(`
    SELECT id, subject_id, report_month, score, comment,
           written_at, corrected_at, correction_count
      FROM staff_reports
     ORDER BY written_at DESC
     LIMIT 10`);
  console.table(rows);
  await client.end();
})().catch((e) => { console.error('Check failed:', e.message); process.exit(1); });

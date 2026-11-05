/**
 * Read only. Shows the shapes of existing admission numbers.
 *   node scripts/admission-shapes.js
 */
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});
const { pool } = require('../src/db');

async function main() {
  const { rows } = await pool.query(
    `SELECT regexp_replace(regexp_replace(admission_no, '[0-9]', '9', 'g'), '[A-Za-z]', 'A', 'g') AS shape,
            COUNT(*)::int AS students,
            MIN(admission_no) AS example
     FROM students
     GROUP BY 1
     ORDER BY 2 DESC
     LIMIT 40`
  );
  rows.forEach((r) => {
    console.log(`${String(r.students).padStart(5)}  ${r.shape.padEnd(24)} e.g. ${r.example}`);
  });
}

main()
  .catch((err) => { console.error('Failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());

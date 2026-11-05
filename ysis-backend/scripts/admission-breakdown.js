/**
 * Read only. Breaks down admission numbers by prefix and year,
 * and lists the ones that do not fit PREFIX/YYYY/NNNN.
 *   node scripts/admission-breakdown.js
 */
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});
const { pool } = require('../src/db');

async function main() {
  const fit = await pool.query(
    `SELECT split_part(admission_no, '/', 1) AS prefix,
            split_part(admission_no, '/', 2) AS year,
            COUNT(*)::int AS students,
            MIN(split_part(admission_no, '/', 3)) AS first_no,
            MAX(split_part(admission_no, '/', 3)) AS last_no
     FROM students
     WHERE admission_no ~ '^[A-Za-z]+/[0-9]{4}/[0-9]{4}$'
     GROUP BY 1, 2
     ORDER BY 1, 2`
  );
  console.log('PREFIX  YEAR  COUNT  FIRST  LAST');
  fit.rows.forEach((r) =>
    console.log(`${r.prefix.padEnd(7)} ${r.year}  ${String(r.students).padStart(5)}  ${r.first_no}  ${r.last_no}`)
  );

  const odd = await pool.query(
    `SELECT admission_no, full_name, class_level, created_at::date AS created
     FROM students
     WHERE admission_no !~ '^[A-Za-z]+/[0-9]{4}/[0-9]{4}$'
     ORDER BY admission_no`
  );
  console.log('\nNOT matching PREFIX/YYYY/NNNN:');
  odd.rows.forEach((r) =>
    console.log(`${r.admission_no} | ${r.full_name} | ${r.class_level} | ${r.created}`)
  );
}

main()
  .catch((err) => { console.error('Failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());

/**
 * Deletes student data from the database. DRY RUN unless --apply is given.
 *
 *   node scripts/wipe-student-data.js                          dry run, ALL students
 *   node scripts/wipe-student-data.js --test-only              dry run, only TEST/% admission numbers
 *   node scripts/wipe-student-data.js --apply --backup-done    delete (ALL students)
 *   node scripts/wipe-student-data.js --test-only --apply --backup-done
 *
 * Deletes: students, student_photos, sync_operations, conflicts,
 *          admission_merge_queue, notifications about those students and,
 *          in ALL mode, student_import_batches.
 * Keeps:   users, devices, permissions, staff_directory, audit_logs.
 *
 * Run it while no device is syncing. Phones keep their own local copy,
 * so clear the app data on each phone afterwards.
 */
const fs = require('fs');

for (const file of ['.env', '.env.production', '.env.development']) {
  if (!process.env.DATABASE_URL && fs.existsSync(file)) {
    require('dotenv').config({ path: file });
    console.log(`Loaded settings from ${file}`);
  }
}
if (!process.env.DATABASE_URL) {
  console.error('ABORT: DATABASE_URL not found in .env, .env.production or .env.development.');
  process.exit(1);
}

const db = require('../src/db');

const apply = process.argv.includes('--apply');
const backupDone = process.argv.includes('--backup-done');
const testOnly = process.argv.includes('--test-only');

function describeTarget() {
  const url = new URL(process.env.DATABASE_URL);
  return `${url.host}${url.pathname}`; // host and database name only, never credentials
}

// Each step: a table and the condition that picks the rows to delete.
// $1 is the array of student ids being wiped.
function buildSteps() {
  if (testOnly) {
    return [
      ['conflicts', `student_id = ANY($1::uuid[]) OR sync_operation_id IN (SELECT id FROM sync_operations WHERE entity_id = ANY($1::uuid[]))`],
      ['admission_merge_queue', `record_a_id = ANY($1::uuid[]) OR record_b_id = ANY($1::uuid[]) OR canonical_id = ANY($1::uuid[]) OR discarded_id = ANY($1::uuid[])`],
      ['student_photos', `student_id = ANY($1::uuid[])`],
      ['sync_operations', `entity_id = ANY($1::uuid[])`],
      ['notifications', `related_entity_id = ANY($1::uuid[])`],
      ['students', `id = ANY($1::uuid[])`],
    ];
  }
  return [
    ['conflicts', 'TRUE'],
    ['admission_merge_queue', 'TRUE'],
    ['student_photos', 'TRUE'],
    ['sync_operations', 'TRUE'],
    ['notifications', `related_entity_id = ANY($1::uuid[])`],
    ['student_import_batches', 'TRUE'],
    ['students', 'TRUE'],
  ];
}

async function main() {
  console.log(`Database: ${describeTarget()}`);
  console.log(`Scope:    ${testOnly ? "only admission numbers starting with 'TEST/'" : 'ALL students'}`);
  console.log(`Mode:     ${apply ? 'APPLY (will delete)' : 'DRY RUN (nothing is deleted)'}\n`);

  if (apply && !backupDone) {
    console.error('ABORT: add --backup-done to confirm you have a database backup.');
    process.exit(1);
  }

  await db.withTransaction(async (client) => {
    const { rows } = await client.query(
      testOnly
        ? `SELECT id FROM students WHERE admission_no LIKE 'TEST/%'`
        : `SELECT id FROM students`
    );
    const ids = rows.map((r) => r.id);
    console.log(`Students in scope: ${ids.length}`);

    for (const [table, where] of buildSteps()) {
      const params = where.includes('$1') ? [ids] : [];
      if (apply) {
        const res = await client.query(`DELETE FROM ${table} WHERE ${where}`, params);
        console.log(`  deleted ${String(res.rowCount).padStart(6)}  ${table}`);
      } else {
        const res = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params);
        console.log(`  would delete ${String(res.rows[0].n).padStart(6)}  ${table}`);
      }
    }

    if (apply) {
      const left = await client.query('SELECT count(*)::int AS n FROM students');
      console.log(`\nStudents remaining: ${left.rows[0].n}`);
    }
  });

  console.log(apply ? '\nDone. Changes committed.' : '\nDry run only. Nothing was changed.');
}

main()
  .catch((err) => {
    console.error('FAILED (nothing was changed):', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());

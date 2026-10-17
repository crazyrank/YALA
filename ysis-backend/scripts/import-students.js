'use strict';

/**
 * Bulk student import from a CSV file, run from the terminal.
 *
 * Dry run by default. Nothing is written unless --commit is passed.
 *
 *   node scripts/import-students.js students.csv --as <email of Director or Principal>
 *   node scripts/import-students.js students.csv --as <email of Director or Principal> --commit
 *
 * The checks come from src/services/studentImportCore.js, the same file the app
 * endpoint uses, so the terminal and the app can never disagree.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MAX_ROWS, MAX_BYTES, parseCsv, checkHeader, analyzeRows } = require('../src/services/studentImportCore');

function stop(message) {
  console.error(`\nIMPORT STOPPED: ${message}\nNothing was written.`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { file: null, as: null, commit: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--commit') out.commit = true;
    else if (a === '--as') out.as = argv[++i] || null;
    else if (!a.startsWith('--')) out.file = a;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) stop('no CSV file given. Usage: node scripts/import-students.js students.csv --as <email>');
  if (!args.as) stop('no admin given. Add --as <email of a Director or Principal>.');

  const filePath = path.resolve(args.file);
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    stop('the CSV file could not be found.');
  }
  if (stat.size > MAX_BYTES) stop('the file is larger than 1 MB. Split it into smaller files.');

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(filePath));
  } catch {
    stop('the file is not valid UTF-8. Save it again as "CSV UTF-8".');
  }
  text = text.replace(/^\uFEFF/, '');

  let table;
  try {
    table = parseCsv(text);
  } catch (err) {
    stop(err.message);
  }
  if (table.length < 2) stop('the file has no student rows under the header.');

  const headerProblems = checkHeader(table[0]);
  if (headerProblems.length > 0) stop(`the header is wrong: ${headerProblems.join('; ')}.`);

  const dataRows = table.slice(1);
  if (dataRows.length > MAX_ROWS) stop(`the file has ${dataRows.length} rows. The limit is ${MAX_ROWS}.`);

  // Everything below needs the database. Loaded here so the checks above work without it.
  const db = require('../src/db');
  const { writeAudit } = require('../src/middleware/audit');

  const adminRes = await db.query(
    'SELECT id, role, status FROM users WHERE lower(email) = lower($1)',
    [args.as.trim()]
  );
  if (adminRes.rows.length !== 1) stop('the --as account was not found, or the email matches more than one account.');
  const admin = adminRes.rows[0];
  if (!['director', 'principal'].includes(admin.role) || admin.status !== 'active') {
    stop('the --as account must be an active Director or Principal.');
  }

  const { valid, rejected } = analyzeRows(table[0], dataRows);

  // Skip admission numbers that already exist. Existing records are never changed.
  const keys = [...new Set(valid.map((v) => v.value.admissionNo.toLowerCase()))];
  const existing = new Set();
  if (keys.length > 0) {
    const res = await db.query(
      'SELECT lower(admission_no) AS k FROM students WHERE lower(admission_no) = ANY($1::text[])',
      [keys]
    );
    for (const r of res.rows) existing.add(r.k);
  }

  const toInsert = [];
  for (const item of valid) {
    if (existing.has(item.value.admissionNo.toLowerCase())) {
      rejected.push({ row: item.sourceRow, column: 'admission_no', reason: 'already exists in the database (not changed)' });
    } else {
      toInsert.push(item);
    }
  }
  rejected.sort((a, b) => a.row - b.row);

  console.log(`\nRows in file:        ${dataRows.length}`);
  console.log(`Ready to import:     ${toInsert.length}`);
  console.log(`Skipped:             ${rejected.length}`);
  if (rejected.length > 0) {
    console.log('\nSkipped rows (row number, column, reason). No student values are shown:');
    console.table(rejected);
  }

  if (!args.commit) {
    console.log('\nDRY RUN. Nothing was written. Fix the skipped rows if needed, then add --commit to import.');
    return;
  }
  if (toInsert.length === 0) {
    console.log('\nNothing to import.');
    return;
  }

  await db.withTransaction(async (client) => {
    for (const item of toInsert) {
      const v = item.value;
      await client.query(
        `INSERT INTO students
           (id, admission_no, full_name, division, class_level, arm, gender,
            guardian_name, guardian_phone, registered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          crypto.randomUUID(),
          v.admissionNo,
          v.fullName,
          v.division,
          v.classLevel,
          v.arm,
          v.gender,
          v.guardianName,
          v.guardianPhone,
          admin.id,
        ]
      );
    }
  });

  await writeAudit({
    userId: admin.id,
    action: 'STUDENTS_BULK_IMPORTED',
    entityType: 'student',
    result: 'success',
    metadata: { source: 'terminal', imported: toInsert.length, skipped: rejected.length, sourceRows: dataRows.length },
  });

  console.log(`\nImported ${toInsert.length} students.`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('Import failed and was rolled back:', err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        const db = require('../src/db');
        await db.pool.end();
      } catch {
        /* database was never loaded */
      }
    });
}

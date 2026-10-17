'use strict';

/**
 * Bulk student import from a CSV file.
 *
 * Dry run by default. Nothing is written unless --commit is passed.
 *
 *   node scripts/import-students.js students.csv --as <email of Director or Principal>
 *   node scripts/import-students.js students.csv --as <email of Director or Principal> --commit
 *
 * Rules:
 * - The header must match the expected columns exactly. No date_of_birth column.
 * - Each row is cleaned and checked by the shared rules (src/utils/studentRules.js).
 * - Bad rows are skipped and listed by row number and column. Values are never printed.
 * - Admission numbers are compared case-insensitively. Every copy inside the file is skipped.
 * - Admission numbers already in the database are skipped. Existing records are never changed.
 * - Valid rows are inserted in ONE transaction. If any insert fails, nothing is saved.
 * - The import is recorded in the audit log as one summary entry.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeStudent } = require('../src/utils/studentRules');

const HEADER = [
  'admission_no', 'full_name', 'division', 'class_level',
  'arm', 'guardian_name', 'guardian_phone', 'gender',
];

// Report names use the CSV column names, so staff can find the column in their file.
const API_TO_CSV = {
  admissionNo: 'admission_no',
  fullName: 'full_name',
  classLevel: 'class_level',
  guardianName: 'guardian_name',
  guardianPhone: 'guardian_phone',
};
const MAX_BYTES = 1024 * 1024; // 1 MB
const MAX_ROWS = 2000;

/** Minimal CSV parser: quoted fields, escaped quotes, commas and line breaks inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // ignored; "\n" ends the row
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  if (inQuotes) throw new Error('the file has an unclosed quote');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** Returns a list of header problems. Empty list means the header is correct. */
function checkHeader(headerCells) {
  const header = headerCells.map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
  const problems = [];
  for (const expected of HEADER) {
    if (!header.includes(expected)) problems.push(`missing column "${expected}"`);
  }
  for (const found of header) {
    if (!HEADER.includes(found)) problems.push(`unexpected column "${found}"`);
  }
  if (new Set(header).size !== header.length) problems.push('a column name appears more than once');
  return problems;
}

/**
 * Checks every data row against the shared rules and against other rows in the file.
 * Pure function: no database. Returns { valid, rejected }.
 *   valid:    [{ rowNo, value }]  where value uses the API field names
 *   rejected: [{ row, column, reason }]  where column is a column name, never a value
 */
function analyzeRows(headerCells, dataRows) {
  const header = headerCells.map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
  const valid = [];
  const rejected = [];

  dataRows.forEach((cells, index) => {
    const rowNo = index + 2; // row 1 is the header

    if (cells.length !== header.length) {
      rejected.push({ row: rowNo, column: '(row)', reason: `expected ${header.length} columns, found ${cells.length}` });
      return;
    }

    const raw = {};
    header.forEach((name, i) => { raw[name] = cells[i]; });

    const result = normalizeStudent({
      admissionNo: raw.admission_no,
      fullName: raw.full_name,
      division: raw.division,
      classLevel: raw.class_level,
      arm: raw.arm,
      gender: raw.gender,
      guardianName: raw.guardian_name,
      guardianPhone: raw.guardian_phone,
    });

    if (!result.ok) {
      for (const message of result.errors) {
        const cut = message.indexOf(':');
        const apiName = message.slice(0, cut);
        rejected.push({
          row: rowNo,
          column: API_TO_CSV[apiName] || apiName,
          reason: message.slice(cut + 2),
        });
      }
      return;
    }

    valid.push({ rowNo, value: result.value });
  });

  // Every copy of a duplicate admission number is skipped, so no guess is made about which is right.
  const rowsByKey = new Map();
  for (const item of valid) {
    const key = item.value.admissionNo.toLowerCase();
    if (!rowsByKey.has(key)) rowsByKey.set(key, []);
    rowsByKey.get(key).push(item.rowNo);
  }

  const kept = [];
  for (const item of valid) {
    const key = item.value.admissionNo.toLowerCase();
    if (rowsByKey.get(key).length > 1) {
      rejected.push({ row: item.rowNo, column: 'admission_no', reason: 'appears more than once in this file' });
    } else {
      kept.push(item);
    }
  }

  rejected.sort((a, b) => a.row - b.row);
  return { valid: kept, rejected };
}

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

  // Everything below needs the database. Loaded here so the pure checks above can be tested without it.
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
      rejected.push({ row: item.rowNo, column: 'admission_no', reason: 'already exists in the database (not changed)' });
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
    metadata: { imported: toInsert.length, skipped: rejected.length, sourceRows: dataRows.length },
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

module.exports = { parseCsv, checkHeader, analyzeRows, HEADER };

'use strict';

/**
 * Pure student import logic: CSV parsing, header checks, row checks, and
 * duplicate checks. No database, no network.
 *
 * This exact file is also copied into the mobile app, so the phone's preview
 * and the server's checks always use the same rules.
 */

const { normalizeStudent } = require('../utils/studentRules');
const { normalizeSession } = require('../utils/academicSession');

const HEADER = [
  'admission_no', 'full_name', 'division', 'class_level',
  'arm', 'guardian_name', 'guardian_phone', 'gender',
  'date_of_birth', 'session',
];

// Report names use the CSV column names, so staff can find the column in their file.
const API_TO_CSV = {
  admissionNo: 'admission_no',
  fullName: 'full_name',
  classLevel: 'class_level',
  guardianName: 'guardian_name',
  guardianPhone: 'guardian_phone',
  dateOfBirth: 'date_of_birth',
};

const MAX_ROWS = 2000;
const MAX_BYTES = 1024 * 1024; // 1 MB
const MAX_CELL_LENGTH = 200;

function normalizeHeaderName(name) {
  return String(name ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
}

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
  const header = headerCells.map(normalizeHeaderName);
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
 * Checks records against the shared rules and against each other.
 * Each record: { sourceRow, data } where data is keyed by CSV column names,
 * or { sourceRow, invalidShape: "message" } for a row with the wrong number of cells.
 * Returns { valid, rejected }:
 *   valid:    [{ sourceRow, value }]        value uses the API field names
 *   rejected: [{ row, column, reason }]     column is a column name, never a value
 */
function analyzeRecords(records) {
  const valid = [];
  const rejected = [];

  for (const rec of records) {
    if (rec.invalidShape) {
      rejected.push({ row: rec.sourceRow, column: '(row)', reason: rec.invalidShape });
      continue;
    }

    const d = rec.data;
    const text = (x) => String(x ?? '').trim();
    const dobRaw = text(d.date_of_birth);
    // Staff write dates as DD/MM/YYYY. The shared rules and the database use YYYY-MM-DD.
    const dobMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dobRaw);
    const dobIso = dobMatch ? `${dobMatch[3]}-${dobMatch[2]}-${dobMatch[1]}` : '';
    const gender = text(d.gender);
    const sessionRaw = text(d.session);

    const result = normalizeStudent({
      admissionNo: d.admission_no,
      fullName: d.full_name,
      division: d.division,
      classLevel: d.class_level,
      arm: d.arm,
      gender,
      guardianName: d.guardian_name,
      guardianPhone: d.guardian_phone,
      dateOfBirth: dobIso,
    });

    const problems = [];
    if (!result.ok) {
      for (const message of result.errors) {
        const cut = message.indexOf(':');
        const apiName = message.slice(0, cut);
        problems.push({ column: API_TO_CSV[apiName] || apiName, reason: message.slice(cut + 2) });
      }
    }

    // Gender, date of birth and session are compulsory for imports.
    // The shared student rules still allow them to be empty for other entry points.
    if (gender === '') problems.push({ column: 'gender', reason: 'is required (M or F)' });
    if (dobRaw === '') problems.push({ column: 'date_of_birth', reason: 'is required (use DD/MM/YYYY, for example 25/03/2014)' });
    else if (!dobMatch) problems.push({ column: 'date_of_birth', reason: 'must be written as DD/MM/YYYY, for example 25/03/2014' });

    let session = null;
    if (sessionRaw === '') {
      problems.push({ column: 'session', reason: 'is required (for example 2024/2025)' });
    } else {
      session = normalizeSession(sessionRaw);
      if (!session) problems.push({ column: 'session', reason: 'is not a valid session (use the form 2024/2025)' });
    }

    if (problems.length > 0) {
      for (const p of problems) rejected.push({ row: rec.sourceRow, column: p.column, reason: p.reason });
      continue;
    }

    valid.push({ sourceRow: rec.sourceRow, value: { ...result.value, academicSession: session } });
  }

  // Every copy of a duplicate admission number is skipped. No guess is made about which is right.
  const rowsByKey = new Map();
  for (const item of valid) {
    const key = item.value.admissionNo.toLowerCase();
    if (!rowsByKey.has(key)) rowsByKey.set(key, []);
    rowsByKey.get(key).push(item.sourceRow);
  }

  const kept = [];
  for (const item of valid) {
    const key = item.value.admissionNo.toLowerCase();
    if (rowsByKey.get(key).length > 1) {
      rejected.push({ row: item.sourceRow, column: 'admission_no', reason: 'appears more than once in this file' });
    } else {
      kept.push(item);
    }
  }

  rejected.sort((a, b) => a.row - b.row);
  return { valid: kept, rejected };
}

/**
 * Convenience wrapper for CSV text that has already been parsed into cells.
 * Row numbers match the file: row 1 is the header, so the first data row is row 2.
 */
function analyzeRows(headerCells, dataRows) {
  const header = headerCells.map(normalizeHeaderName);
  const records = dataRows.map((cells, index) => {
    const sourceRow = index + 2;
    if (cells.length !== header.length) {
      return { sourceRow, invalidShape: `expected ${header.length} columns, found ${cells.length}` };
    }
    const data = {};
    header.forEach((name, i) => { data[name] = cells[i]; });
    return { sourceRow, data };
  });
  return analyzeRecords(records);
}

module.exports = {
  HEADER,
  API_TO_CSV,
  MAX_ROWS,
  MAX_BYTES,
  MAX_CELL_LENGTH,
  parseCsv,
  checkHeader,
  analyzeRecords,
  analyzeRows,
};

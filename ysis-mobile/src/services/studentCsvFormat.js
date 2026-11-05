/**
 * Student CSV format for export. Pure: no database, no device APIs, so the
 * same file can be checked by the import rules in a test.
 *
 * The export header is the import header, exactly. A file exported here can be
 * imported again without editing.
 */

import { HEADER, analyzeRows } from './studentImportCore';
import { isoToDob } from '../utils/dobFormat';

// Export this many students per file, so every file stays under the import limits.
export const EXPORT_CHUNK_ROWS = 2000;

// Spreadsheet apps run cells starting with these characters as formulas.
// The import rules already refuse names that start this way, so guarding them is safe.
const FORMULA_START = /^[=+\-@\t\r]/;

function neutralizeFormula(value) {
  if (typeof value !== 'string') return value;
  return FORMULA_START.test(value) ? "'" + value : value;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Turns one database row into the import cells, in HEADER order.
 * Date of birth goes out as DD/MM/YYYY. The session is the registered session.
 * Guardian phone is not guarded: the import rules allow a leading "+", and a
 * guard would make the number fail on re-import.
 */
export function studentToCells(row) {
  return HEADER.map((key) => {
    let value = key === 'date_of_birth' ? isoToDob(row[key]) : row[key];
    if (key !== 'guardian_phone') value = neutralizeFormula(value);
    return value === null || value === undefined ? '' : String(value);
  });
}

/** Builds the full CSV text for a list of cell rows (header first). */
export function buildCsvText(cellRows) {
  const lines = [HEADER.join(',')];
  for (const cells of cellRows) {
    lines.push(cells.map(escapeCsvValue).join(','));
  }
  // Byte-order mark so Excel reads the names and accents as UTF-8.
  // The import strips it again.
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Reports how many of these students would be skipped if the file were imported.
 * Uses the same rules as the import, so the count matches what the server will say.
 */
export function countNotReimportable(cellRows) {
  const { valid, rejected } = analyzeRows(HEADER, cellRows);
  const badRows = new Set(rejected.map((r) => r.row));
  return { importable: valid.length, notImportable: badRows.size };
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

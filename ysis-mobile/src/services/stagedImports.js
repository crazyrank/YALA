import { getDb } from '../db';
import { api } from '../api/client';
import * as FileSystem from 'expo-file-system/legacy';
import { v4 as uuidv4 } from 'uuid';
import {
  MAX_ROWS,
  MAX_BYTES,
  parseCsv,
  checkHeader,
  analyzeRows,
  HEADER,
} from './studentImportCore';

const REPLACEMENT_CHAR = '\uFFFD';

function fail(message) {
  return { ok: false, message };
}

/**
 * Reads and checks a CSV file on the phone. Saves nothing.
 * Returns { ok, ready, localSkipped, readyCount, skippedCount, totalRows } or { ok: false, message }.
 * `ready` keeps the original cell values, because the server re-runs every check on them.
 */
export async function previewCsvFile({ uri, sizeBytes }) {
  if (sizeBytes && sizeBytes > MAX_BYTES) {
    return fail('The file is larger than 1 MB. Split it into smaller files.');
  }

  let text;
  try {
    text = await FileSystem.readAsStringAsync(uri);
  } catch {
    return fail('The file could not be read.');
  }
  // A replacement character means the bytes were not valid UTF-8.
  if (text.includes(REPLACEMENT_CHAR)) {
    return fail('The file is not valid UTF-8. Save it again as "CSV UTF-8".');
  }
  text = text.replace(/^\uFEFF/, '');

  let table;
  try {
    table = parseCsv(text);
  } catch (err) {
    return fail(err.message);
  }
  if (table.length < 2) return fail('The file has no student rows under the header.');

  const headerProblems = checkHeader(table[0]);
  if (headerProblems.length > 0) {
    return fail(`The header is wrong: ${headerProblems.join('; ')}.`);
  }

  const dataRows = table.slice(1);
  if (dataRows.length > MAX_ROWS) {
    return fail(`The file has ${dataRows.length} rows. The limit is ${MAX_ROWS}.`);
  }

  const { valid, rejected } = analyzeRows(table[0], dataRows);

  const header = table[0].map((h) => String(h).replace(/^\uFEFF/, '').trim().toLowerCase());
  const rawByRow = new Map();
  dataRows.forEach((cells, index) => {
    if (cells.length !== header.length) return;
    const data = {};
    header.forEach((name, i) => { data[name] = cells[i]; });
    rawByRow.set(index + 2, data);
  });

  const ready = valid.map((v) => ({ sourceRow: v.sourceRow, data: rawByRow.get(v.sourceRow) }));
  return {
    ok: true,
    ready,
    localSkipped: rejected,
    readyCount: ready.length,
    skippedCount: rejected.length,
    totalRows: dataRows.length,
  };
}

/** Saves a checked preview on the phone under a new import key. Nothing is sent yet. */
export async function stageImport({ fileName, preview }) {
  const db = await getDb();
  const importKey = uuidv4();
  await db.runAsync(
    `INSERT INTO staged_imports
       (import_key, file_name, created_at, status, ready_count, local_skipped_json, rows_json)
     VALUES (?, ?, ?, 'staged', ?, ?, ?)`,
    [
      importKey,
      String(fileName || 'students.csv').slice(0, 120),
      new Date().toISOString(),
      preview.readyCount,
      JSON.stringify(preview.localSkipped),
      JSON.stringify(preview.ready),
    ]
  );
  return importKey;
}

export async function listStagedImports() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT import_key, file_name, created_at, status, ready_count,
            local_skipped_json, server_result_json, error_code, last_attempt_at
       FROM staged_imports
      ORDER BY created_at DESC`
  );
}

/**
 * Sends one staged import. Safe to call again: the same import key always gives
 * the same result on the server.
 *   completed: the server confirmed. The student rows are deleted from the phone.
 *   retry:     connection or server busy. The rows are kept for the next attempt.
 *   failed:    the server refused. The rows are deleted from the phone.
 */
export async function uploadStagedImport(importKey) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT * FROM staged_imports WHERE import_key = ?',
    [importKey]
  );
  if (!row) return { state: 'missing' };
  if (row.status === 'completed') {
    return { state: 'completed', result: JSON.parse(row.server_result_json || 'null') };
  }
  if (!row.rows_json) {
    await db.runAsync(
      `UPDATE staged_imports SET status = 'failed', error_code = 'NO_ROWS' WHERE import_key = ?`,
      [importKey]
    );
    return { state: 'failed', code: 'NO_ROWS' };
  }

  await db.runAsync(
    `UPDATE staged_imports SET status = 'uploading', last_attempt_at = ? WHERE import_key = ?`,
    [new Date().toISOString(), importKey]
  );

  try {
    const rows = JSON.parse(row.rows_json);
    const result = await api.post('/students/import', { importKey, rows });
    await db.runAsync(
      `UPDATE staged_imports
          SET status = 'completed', server_result_json = ?, rows_json = '', error_code = NULL
        WHERE import_key = ?`,
      [JSON.stringify(result), importKey]
    );
    return { state: 'completed', result };
  } catch (err) {
    const code = err.code || 'UNKNOWN_ERROR';
    const temporary =
      err.isNetworkError ||
      err.status === 401 ||
      code === 'IMPORT_IN_PROGRESS' ||
      (typeof err.status === 'number' && err.status >= 500);

    if (temporary) {
      // Keep the rows. Sending the same key again is safe.
      await db.runAsync(
        `UPDATE staged_imports SET status = 'staged', error_code = ? WHERE import_key = ?`,
        [code, importKey]
      );
      return { state: 'retry', code, message: err.message };
    }

    // The server refused. Do not keep student data for an import that cannot succeed.
    await db.runAsync(
      `UPDATE staged_imports SET status = 'failed', error_code = ?, rows_json = '' WHERE import_key = ?`,
      [code, importKey]
    );
    return { state: 'failed', code, message: err.message };
  }
}

/** Sends every import that is still waiting. Used when the Import screen opens. */
export async function uploadAllPending() {
  const db = await getDb();
  const pending = await db.getAllAsync(
    `SELECT import_key FROM staged_imports WHERE status IN ('staged', 'uploading') ORDER BY created_at`
  );
  const outcomes = [];
  for (const p of pending) {
    // eslint-disable-next-line no-await-in-loop
    outcomes.push(await uploadStagedImport(p.import_key));
  }
  return outcomes;
}

/** Deletes a staged import from the phone. Refused while an upload is in progress. */
export async function discardStagedImport(importKey) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT status FROM staged_imports WHERE import_key = ?',
    [importKey]
  );
  if (!row) return { ok: true };
  if (row.status === 'uploading') {
    return { ok: false, message: 'This import is uploading. Wait for it to finish.' };
  }
  await db.runAsync('DELETE FROM staged_imports WHERE import_key = ?', [importKey]);
  return { ok: true };
}

export { HEADER };

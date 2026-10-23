/**
 * Shared student fetch + cache.
 * - The first pull downloads everyone. Later pulls download only students
 *   changed since the saved cursor, so most pulls are one short request.
 * - Each page is saved together with its cursor, so an interrupted pull
 *   resumes where it stopped.
 * - Retries each page with backoff on network, 429 and 5xx errors.
 * - Concurrent callers share one pull.
 */
import { getDb } from '../db';
import { api } from '../api/client';

const PAGE_SIZE = 200;
const THROTTLE_MS = 30 * 1000;
const PAGE_RETRIES = 3;
const MAX_PAGES = 500;
const CURSOR_KEY = 'students_cursor';
const START_CURSOR = {
  since: '1970-01-01T00:00:00.000Z',
  afterId: '00000000-0000-0000-0000-000000000000',
};

let lastSuccessAt = 0;
let inFlight = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchChangesPage(cursor) {
  const query =
    `since=${encodeURIComponent(cursor.since)}` +
    `&afterId=${encodeURIComponent(cursor.afterId)}` +
    `&limit=${PAGE_SIZE}`;

  let lastErr;
  for (let attempt = 0; attempt < PAGE_RETRIES; attempt += 1) {
    try {
      return await api.get(`/students/changes?${query}`);
    } catch (err) {
      lastErr = err;
      const retryable =
        err.isNetworkError ||
        err.status === 429 ||
        (typeof err.status === 'number' && err.status >= 500);
      if (!retryable) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr;
}

async function ensureSyncStateTable(db) {
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  );
}

async function readCursor(db) {
  const row = await db.getFirstAsync(
    'SELECT value FROM sync_state WHERE key = ?',
    [CURSOR_KEY]
  );
  if (!row) return START_CURSOR;
  try {
    const parsed = JSON.parse(row.value);
    if (parsed?.since && parsed?.afterId) return parsed;
  } catch {
    // A corrupt cursor means starting over, which is safe.
  }
  return START_CURSOR;
}

async function savePage(db, students, nextCursor) {
  const stamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const s of students) {
      await db.runAsync(
        `INSERT INTO students
           (id, admission_no, full_name, division, class_level, arm, status, sync_version, created_at, updated_at, academic_session)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           admission_no = excluded.admission_no,
           full_name    = excluded.full_name,
           division     = excluded.division,
           class_level  = excluded.class_level,
           arm          = excluded.arm,
           status       = excluded.status,
           sync_version = excluded.sync_version,
           updated_at   = excluded.updated_at,
           academic_session = excluded.academic_session
         WHERE students.local_dirty = 0`,
        [
          s.id, s.admission_no, s.full_name, s.division || 'secondary',
          s.class_level, s.arm, s.status, s.sync_version, s.created_at || stamp, stamp, s.academic_session || null,
        ]
      );
    }

    await db.runAsync(
      `INSERT INTO sync_state (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [CURSOR_KEY, JSON.stringify(nextCursor)]
    );
  });
}

async function countLocalStudents(db) {
  const row = await db.getFirstAsync('SELECT COUNT(*) AS c FROM students');
  return Number(row?.c || 0);
}

async function runPull(force) {
  const db = await getDb();
  await ensureSyncStateTable(db);

  const now = Date.now();
  if (!force && lastSuccessAt > 0 && now - lastSuccessAt < THROTTLE_MS) {
    return { total: await countLocalStudents(db), pages: 0, throttled: true };
  }

  let cursor = await readCursor(db);
  let pages = 0;

  while (pages < MAX_PAGES) {
    const response = await fetchChangesPage(cursor);
    const students = Array.isArray(response?.students) ? response.students : [];
    const nextCursor = response?.nextCursor || cursor;

    await savePage(db, students, nextCursor);
    cursor = nextCursor;
    pages += 1;

    if (!response?.hasMore) break;
  }

  lastSuccessAt = Date.now();
  return { total: await countLocalStudents(db), pages, throttled: false };
}

export function fetchAndCacheAllStudents({ force = false } = {}) {
  if (inFlight) return inFlight;
  inFlight = runPull(force).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export async function getLocalStudentCount() {
  const db = await getDb();
  return countLocalStudents(db);
}

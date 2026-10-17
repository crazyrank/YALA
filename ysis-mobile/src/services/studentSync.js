/**
 * Shared student fetch + cache (stale-while-revalidate)
 * - Fully paginates /students
 * - Saves each page as it arrives, so a failure part-way keeps the progress
 * - Retries each page with backoff on network, 429 and 5xx errors
 * - Concurrent callers share one pull
 * - Returns total so list + dashboard never disagree
 */
import { getDb } from '../db';
import { api } from '../api/client';

const PAGE_SIZE = 30;
const THROTTLE_MS = 30 * 1000;
const PAGE_RETRIES = 3;
const MAX_PAGES = 200;

let lastSuccessAt = 0;
let inFlight = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(page) {
  let lastErr;
  for (let attempt = 0; attempt < PAGE_RETRIES; attempt += 1) {
    try {
      return await api.get(`/students?page=${page}`);
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

async function savePage(db, students) {
  const stamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const s of students) {
      await db.runAsync(
        `INSERT INTO students
           (id, admission_no, full_name, division, class_level, arm, status, sync_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           admission_no = excluded.admission_no,
           full_name    = excluded.full_name,
           division     = excluded.division,
           class_level  = excluded.class_level,
           arm          = excluded.arm,
           status       = excluded.status,
           sync_version = excluded.sync_version,
           updated_at   = excluded.updated_at
         WHERE students.local_dirty = 0`,
        [
          s.id, s.admission_no, s.full_name, s.division || 'secondary',
          s.class_level, s.arm, s.status, s.sync_version, stamp, stamp,
        ]
      );
    }
  });
}

async function runPull(force) {
  const now = Date.now();
  if (!force && lastSuccessAt > 0 && now - lastSuccessAt < THROTTLE_MS) {
    const db = await getDb();
    const row = await db.getFirstAsync('SELECT COUNT(*) AS c FROM students');
    return { total: Number(row?.c || 0), pages: 0, throttled: true };
  }

  const db = await getDb();
  let page = 1;
  let total = 0;

  while (page <= MAX_PAGES) {
    const response = await fetchPage(page);
    const students = Array.isArray(response?.students) ? response.students : [];
    if (students.length > 0) await savePage(db, students);
    total += students.length;

    if (students.length < PAGE_SIZE) break;
    page += 1;
  }

  lastSuccessAt = Date.now();
  return { total, pages: page, throttled: false };
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
  const row = await db.getFirstAsync('SELECT COUNT(*) AS c FROM students');
  return Number(row?.c || 0);
}

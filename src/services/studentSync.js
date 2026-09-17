/**
 * Shared student fetch + cache (stale-while-revalidate)
 * - Fully paginates /students (fixes the page=1 only bug)
 * - Writes all rows in one SQLite transaction
 * - Returns total so list + dashboard never disagree
 */
import { getDb } from '../db';
import { api } from '../api/client';

const PAGE_SIZE = 30;
const THROTTLE_MS = 30 * 1000;

let lastSuccessAt = 0;

export async function fetchAndCacheAllStudents({ force = false } = {}) {
  const now = Date.now();
  if (!force && lastSuccessAt > 0 && now - lastSuccessAt < THROTTLE_MS) {
    const db = await getDb();
    const row = await db.getFirstAsync('SELECT COUNT(*) AS c FROM students');
    return { total: Number(row?.c || 0), pages: 0, throttled: true };
  }

  let page = 1;
  let total = 0;
  const allStudents = [];

  while (true) {
    const response = await api.get(`/students?page=${page}`);
    const students = Array.isArray(response?.students) ? response.students : [];
    allStudents.push(...students);
    total += students.length;

    if (students.length < PAGE_SIZE) break;
    page += 1;
  }

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const s of allStudents) {
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
          s.class_level, s.arm, s.status, s.sync_version,
          new Date().toISOString(), new Date().toISOString(),
        ]
      );
    }
  });

  lastSuccessAt = Date.now();
  return { total, pages: page, throttled: false };
}

export async function getLocalStudentCount() {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT COUNT(*) AS c FROM students');
  return Number(row?.c || 0);
}



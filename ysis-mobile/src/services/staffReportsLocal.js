/** Local-first staff reports with a server-authoritative sync queue. */
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getMeta, setMeta } from '../db';
import { api } from '../api/client';
import { queueOperation, triggerSync } from './syncEngine';

const OP_TYPE = 'staff_report_save';

function parseJson(value, fallback = null) {
  try { return JSON.parse(value); } catch (err) { return fallback; }
}

async function unresolvedSubjects(db) {
  const rows = await db.getAllAsync(
    `SELECT payload FROM sync_operations
      WHERE op_type = ? AND status IN ('pending', 'failed', 'conflicted')`,
    [OP_TYPE]
  );
  const ids = new Set();
  for (const row of rows) {
    const payload = parseJson(row.payload, {});
    if (payload.subjectId) ids.add(payload.subjectId);
  }
  return ids;
}

export async function getCachedStaffReports(month = null) {
  const db = await getDb();
  const reportMonth = month || await getMeta('staff_reports_last_month');
  if (!reportMonth) return null;

  const meta = parseJson(await getMeta(`staff_reports_meta_${reportMonth}`), null);
  if (!meta) return null;
  const rows = await db.getAllAsync(
    'SELECT data_json FROM staff_reports_local WHERE report_month = ? ORDER BY full_name COLLATE NOCASE ASC',
    [reportMonth]
  );
  return {
    ...meta,
    subjects: rows.map((row) => parseJson(row.data_json)).filter(Boolean),
  };
}

export async function pullStaffReports() {
  const db = await getDb();
  const response = await api.get('/staff-reports');
  const month = response.month;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) {
    throw new Error('The server returned an invalid staff report month.');
  }

  const subjects = Array.isArray(response.subjects) ? response.subjects : [];
  const allowed = new Set(subjects.map((item) => item.id));

  await db.withTransactionAsync(async () => {
    const waiting = await unresolvedSubjects(db);
    const existing = await db.getAllAsync(
      'SELECT subject_id FROM staff_reports_local WHERE report_month = ?',
      [month]
    );
    for (const row of existing) {
      if (!allowed.has(row.subject_id) && !waiting.has(row.subject_id)) {
        await db.runAsync(
          'DELETE FROM staff_reports_local WHERE subject_id = ? AND report_month = ?',
          [row.subject_id, month]
        );
      }
    }

    for (const subject of subjects) {
      if (!subject || !subject.id || waiting.has(subject.id)) continue;
      await db.runAsync(
        `INSERT INTO staff_reports_local
           (subject_id, report_month, full_name, data_json, local_dirty, cached_at)
         VALUES (?, ?, ?, ?, 0, ?)
         ON CONFLICT(subject_id, report_month) DO UPDATE SET
           full_name = excluded.full_name,
           data_json = excluded.data_json,
           local_dirty = 0,
           cached_at = excluded.cached_at`,
        [subject.id, month, String(subject.fullName || ''), JSON.stringify(subject), new Date().toISOString()]
      );
    }

    await setMeta(`staff_reports_meta_${month}`, JSON.stringify({
      month: response.month,
      currentMonth: response.currentMonth,
      canWrite: response.canWrite === true,
    }));
    await setMeta('staff_reports_last_month', month);
  });

  return getCachedStaffReports(month);
}

export async function getStaffReports() {
  try {
    return await pullStaffReports();
  } catch (err) {
    if (!err?.isNetworkError) throw err;
    const cached = await getCachedStaffReports();
    if (cached) return cached;
    throw err;
  }
}

export async function saveStaffReportOffline(data, subject, values) {
  if (!data || !subject || !subject.id) {
    throw new Error('The staff report data is unavailable. Refresh when connected.');
  }

  const score = Number(values.score);
  const comment = String(values.comment || '').trim();
  const recognition = values.recognition || 'none';
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    throw new Error('Choose a score from 1 to 10.');
  }
  if (!comment || comment.length > 1000) {
    throw new Error('Enter a comment between 1 and 1000 characters.');
  }
  if (!['none', 'teacher_of_the_month', 'teacher_of_the_year'].includes(recognition)) {
    throw new Error('Choose a valid recognition option.');
  }

  const db = await getDb();
  const createdAtClient = new Date().toISOString();
  let entityId;
  let action;

  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync(
      'SELECT data_json FROM staff_reports_local WHERE subject_id = ? AND report_month = ?',
      [subject.id, data.month]
    );
    if (!row) {
      throw new Error('This staff member is not cached on this phone. Connect and refresh first.');
    }
    const current = parseJson(row.data_json);
    if (!current) throw new Error('The cached staff report is invalid. Refresh it when connected.');

    const pending = await unresolvedSubjects(db);
    if (pending.has(subject.id)) {
      throw new Error('A previous report change is still awaiting sync or needs attention. Resolve it before editing again.');
    }

    const existing = current.report;
    if (existing) {
      const writtenAt = Date.parse(existing.writtenAt || '');
      if (existing.canEdit !== true || !Number.isFinite(writtenAt) || Date.now() > writtenAt + 24 * 60 * 60 * 1000) {
        throw new Error('Only the original writer can correct a report, and only within 24 hours.');
      }
      action = 'correct';
      entityId = existing.id;
    } else {
      if (data.canWrite !== true || data.month !== data.currentMonth) {
        throw new Error('Reports can only be created for the current school month.');
      }
      action = 'create';
      entityId = uuidv4();
    }

    const optimisticReport = existing
      ? {
          ...existing,
          score,
          comment,
          recognition,
          originalComment: existing.originalComment || existing.comment,
          correctionCount: Number(existing.correctionCount || 0) + 1,
          correctedAt: createdAtClient,
          canEdit: true,
        }
      : {
          id: entityId,
          score,
          comment,
          originalComment: null,
          recognition,
          writtenByName: 'Awaiting sync',
          writtenAt: createdAtClient,
          correctionCount: 0,
          canEdit: true,
        };

    const optimistic = { ...current, report: optimisticReport };
    const update = await db.runAsync(
      `UPDATE staff_reports_local
          SET data_json = ?, local_dirty = 1, cached_at = ?
        WHERE subject_id = ? AND report_month = ?`,
      [JSON.stringify(optimistic), createdAtClient, subject.id, data.month]
    );
    if (update.changes !== 1) throw new Error('The local report could not be saved.');

    await queueOperation({
      opType: OP_TYPE,
      entityId,
      payload: { action, subjectId: subject.id, reportMonth: data.month, score, comment, recognition },
      deferSync: true,
    });
  });

  // The cache update and operation queue are committed before sync can start.
  triggerSync();
  return { ok: true, queued: true };
}

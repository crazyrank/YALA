#!/usr/bin/env python3
"""Step 3: Log Book (daily school activity, one entry per class per day).

Run from the repo root (~/YALA_SIS), AFTER steps 1d, 2a, 2b and 2c are applied:
    python3 apply_step3.py

Decisions applied (change them here before running if you want something else):
  - Only a Class Teacher writes entries, and only for their own class.
  - Head Teacher, Principal and Director read entries within their scope. Guests cannot read.
  - The writer may correct their own entry for 24 hours. Nobody can delete an entry.
  - An entry can be dated today or up to 7 days back, never in the future.
  - Online only. Offline support is a later batch, because it needs sync engine changes.

Skipped if already applied. Every anchor is checked BEFORE anything is written."""
import os, sys

MIGRATION = r"""/* Step 3: Log Book. One row per entry. Entries are never deleted.
   original_body keeps the first text, so a correction never loses what was written. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS log_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      division TEXT NOT NULL CHECK (division IN ('primary', 'secondary')),
      class_level TEXT NOT NULL,
      arm TEXT,
      entry_date DATE NOT NULL,
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
      original_body TEXT,
      written_by UUID NOT NULL REFERENCES users(id),
      written_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      corrected_at TIMESTAMPTZ,
      correction_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS log_entries_class_date_idx ON log_entries (division, class_level, entry_date DESC);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS log_entries_class_date_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS log_entries;`);
};
"""

RULES = r"""/**
 * Log Book rules. Pure functions, no database.
 * The server decides the class (from the Class Teacher's one assignment), never the client.
 */
const MAX_BODY = 4000;
const MAX_BACKDATE_DAYS = 7;
const EDIT_WINDOW_HOURS = 24;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(earlier, later) {
  const ms = Date.parse(later + 'T00:00:00Z') - Date.parse(earlier + 'T00:00:00Z');
  return Math.round(ms / 86400000);
}

function checkBody(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, code: 'BODY_REQUIRED', message: 'Write what happened in the class.' };
  if (text.length > MAX_BODY) {
    return { ok: false, code: 'BODY_TOO_LONG', message: `Keep the entry under ${MAX_BODY} characters.` };
  }
  return { ok: true, value: text };
}

/** `today` is the school's current date (YYYY-MM-DD, Africa/Lagos), passed in by the route. */
function validateNewEntry({ entryDate, body, today }) {
  const text = checkBody(body);
  if (!text.ok) return text;
  if (typeof entryDate !== 'string' || !DATE_PATTERN.test(entryDate)) {
    return { ok: false, code: 'DATE_INVALID', message: 'Choose a valid date.' };
  }
  if (entryDate > today) {
    return { ok: false, code: 'DATE_IN_FUTURE', message: 'An entry cannot be dated in the future.' };
  }
  if (daysBetween(entryDate, today) > MAX_BACKDATE_DAYS) {
    return { ok: false, code: 'DATE_TOO_OLD', message: `Entries can be dated up to ${MAX_BACKDATE_DAYS} days back.` };
  }
  return { ok: true, value: { entryDate, body: text.value } };
}

function validateCorrection({ body }) {
  const text = checkBody(body);
  if (!text.ok) return text;
  return { ok: true, value: { body: text.value } };
}

module.exports = {
  MAX_BODY,
  MAX_BACKDATE_DAYS,
  EDIT_WINDOW_HOURS,
  DATE_PATTERN,
  validateNewEntry,
  validateCorrection,
};
"""

ROUTES = r"""const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');
const { getScopeForUser, scopeToSqlClause } = require('../services/studentScopeService');
const {
  DATE_PATTERN,
  EDIT_WINDOW_HOURS,
  validateNewEntry,
  validateCorrection,
} = require('../utils/logBookRules');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
  }
}

// Columns returned for every entry. Dates are text so no timezone shifts them.
const ENTRY_COLUMNS = `id, division, class_level, arm,
  to_char(entry_date, 'YYYY-MM-DD') AS entry_date,
  body, original_body, written_by, written_at, corrected_at, correction_count`;

/**
 * POST /log-entries   body { entryDate, body }
 * Class Teacher only. The class comes from the Class Teacher's one assignment.
 */
router.post(
  '/',
  requireAuth,
  requireRole('class_teacher'),
  [body('entryDate').isString(), body('body').isString()],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const { rows: assignments } = await db.query(
        'SELECT division, class_level, arm FROM class_teacher_assignments WHERE user_id = $1',
        [req.auth.userId]
      );
      const assignment = assignments[0];
      if (!assignment) {
        throw Errors.forbidden('You have no class assigned yet. Ask the Principal to assign one.');
      }

      const { rows: todayRows } = await db.query(
        `SELECT to_char((now() AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS today`
      );
      const checked = validateNewEntry({
        entryDate: req.body.entryDate,
        body: req.body.body,
        today: todayRows[0].today,
      });
      if (!checked.ok) throw Errors.badRequest(checked.code, checked.message);

      const { rows } = await db.query(
        `INSERT INTO log_entries (division, class_level, arm, entry_date, body, written_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${ENTRY_COLUMNS}`,
        [
          assignment.division,
          assignment.class_level,
          assignment.arm,
          checked.value.entryDate,
          checked.value.body,
          req.auth.userId,
        ]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'LOG_ENTRY_CREATED',
        entityType: 'log_entry',
        entityId: rows[0].id,
        result: 'success',
        metadata: { classLevel: assignment.class_level, entryDate: checked.value.entryDate },
      });

      return res.status(201).json({ entry: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /log-entries/:id   body { body }
 * The writer only, and only within the correction window. The first text is kept.
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('class_teacher'),
  [param('id').isUUID(), body('body').isString()],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const { rows: found } = await db.query(
        `SELECT ${ENTRY_COLUMNS},
                (now() - written_at) <= make_interval(hours => $2) AS within_window
           FROM log_entries
          WHERE id = $1`,
        [req.params.id, EDIT_WINDOW_HOURS]
      );
      const entry = found[0];
      if (!entry) throw Errors.notFound('That entry could not be found.');
      if (entry.written_by !== req.auth.userId) {
        throw Errors.forbidden('Only the person who wrote this entry can correct it.');
      }
      if (!entry.within_window) {
        throw Errors.forbidden(`Entries can be corrected only within ${EDIT_WINDOW_HOURS} hours of being written.`);
      }

      const checked = validateCorrection({ body: req.body.body });
      if (!checked.ok) throw Errors.badRequest(checked.code, checked.message);

      const { rows } = await db.query(
        `UPDATE log_entries
            SET original_body = COALESCE(original_body, body),
                body = $2,
                corrected_at = now(),
                correction_count = correction_count + 1
          WHERE id = $1
          RETURNING ${ENTRY_COLUMNS}`,
        [req.params.id, checked.value.body]
      );

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: 'LOG_ENTRY_CORRECTED',
        entityType: 'log_entry',
        entityId: req.params.id,
        result: 'success',
        metadata: { correctionCount: rows[0].correction_count },
      });

      return res.json({ entry: rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /log-entries?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N
 * Newest first. Each caller sees only the classes inside their own scope.
 */
router.get(
  '/',
  requireAuth,
  [
    query('from').optional().matches(DATE_PATTERN),
    query('to').optional().matches(DATE_PATTERN),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      if (req.auth.role === 'guest') {
        throw Errors.forbidden('Guests cannot open the Log Book.');
      }

      const from = req.query.from || '2000-01-01';
      const to = req.query.to || '2100-12-31';
      const limit = parseInt(req.query.limit || '100', 10);

      const scope = await getScopeForUser(req.auth);
      const params = [from, to];
      const conditions = ['entry_date BETWEEN $1::date AND $2::date'];
      let idx = 3;

      if (scope !== null) {
        const { clause, params: scopeParams } = scopeToSqlClause(scope, idx);
        conditions.push(clause);
        params.push(...scopeParams);
        idx += scopeParams.length;
      }

      params.push(limit);
      const { rows } = await db.query(
        `SELECT ${ENTRY_COLUMNS},
                (SELECT u.full_name FROM users u WHERE u.id = log_entries.written_by) AS written_by_name
           FROM log_entries
          WHERE ${conditions.join(' AND ')}
          ORDER BY entry_date DESC, written_at DESC
          LIMIT $${idx}`,
        params
      );

      return res.json({ entries: rows });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
"""

SCREEN = r"""import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Online only. The server checks the role, the class, the date and the 24-hour window again.
const MAX_BODY = 4000;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Local calendar day, offsetDays back from today, as YYYY-MM-DD. */
function dayAgo(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function prettyDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function LogBookScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? user?.userId;
  const canWrite = user?.role === 'class_teacher';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const [draft, setDraft] = useState('');
  const [draftDay, setDraftDay] = useState(0);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/log-entries?from=${dayAgo(14)}&to=${dayAgo(0)}&limit=200`);
      setEntries(res?.entries || []);
      setOffline(false);
    } catch (err) {
      if (err?.isNetworkError) {
        setOffline(true);
      } else {
        Alert.alert('Could not load the Log Book', err?.message || 'Try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      Alert.alert('Write something', 'The entry cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/log-entries', { entryDate: dayAgo(draftDay), body: text });
      setDraft('');
      setDraftDay(0);
      await load();
    } catch (err) {
      Alert.alert(
        'Could not save the entry',
        err?.isNetworkError ? 'The Log Book needs an internet connection.' : (err?.message || 'Try again.')
      );
    } finally {
      setSaving(false);
    }
  };

  const canCorrect = (entry) =>
    entry.written_by === userId &&
    Date.now() - new Date(entry.written_at).getTime() <= EDIT_WINDOW_MS;

  const saveEdit = async () => {
    const text = editText.trim();
    if (!text) {
      Alert.alert('Write something', 'The entry cannot be empty.');
      return;
    }
    setSavingEdit(true);
    try {
      await api.patch(`/log-entries/${editingId}`, { body: text });
      setEditingId(null);
      setEditText('');
      await load();
    } catch (err) {
      Alert.alert(
        'Could not save the correction',
        err?.isNetworkError ? 'The Log Book needs an internet connection.' : (err?.message || 'Try again.')
      );
    } finally {
      setSavingEdit(false);
    }
  };

  // Group the entries by day, newest day first. The list is already sorted by the server.
  const days = [];
  for (const entry of entries) {
    const last = days[days.length - 1];
    if (last && last.day === entry.entry_date) {
      last.items.push(entry);
    } else {
      days.push({ day: entry.entry_date, items: [entry] });
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      {offline && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>The Log Book needs an internet connection. Showing nothing until you are online.</Text>
        </View>
      )}

      {canWrite && (
        <View style={styles.card}>
          <Text style={styles.heading}>New entry for your class</Text>
          <View style={styles.chips}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Pressable
                key={n}
                style={[styles.chip, draftDay === n && styles.chipOn]}
                onPress={() => setDraftDay(n)}
                disabled={saving}
              >
                <Text style={[styles.chipText, draftDay === n && styles.chipTextOn]}>
                  {n === 0 ? 'Today' : prettyDay(dayAgo(n))}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="What happened in the class today?"
            multiline
            maxLength={MAX_BODY}
            editable={!saving}
          />
          <Pressable style={[styles.button, saving && styles.disabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save entry</Text>}
          </Pressable>
        </View>
      )}

      {loading && <ActivityIndicator style={styles.spinner} />}

      {!loading && !offline && days.length === 0 && (
        <Text style={styles.body}>No entries in the last two weeks.</Text>
      )}

      {days.map((group) => (
        <View key={group.day} style={styles.dayBlock}>
          <Text style={styles.dayTitle}>{prettyDay(group.day)}</Text>
          {group.items.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <Text style={styles.meta}>
                {entry.class_level}{entry.arm ? ` (${entry.arm})` : ''} · {entry.written_by_name || 'Class teacher'}
                {entry.corrected_at ? ' · corrected' : ''}
              </Text>

              {editingId === entry.id ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                    maxLength={MAX_BODY}
                    editable={!savingEdit}
                  />
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.secondary}
                      onPress={() => { setEditingId(null); setEditText(''); }}
                      disabled={savingEdit}
                    >
                      <Text style={styles.secondaryText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.button} onPress={saveEdit} disabled={savingEdit}>
                      {savingEdit ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save correction</Text>}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.entryText}>{entry.body}</Text>
                  {canCorrect(entry) && (
                    <Pressable
                      style={styles.secondary}
                      onPress={() => { setEditingId(entry.id); setEditText(entry.body); }}
                    >
                      <Text style={styles.secondaryText}>Correct this entry</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 16, paddingBottom: 40 },
  spinner: { marginTop: 14 },
  body: { fontSize: 14, color: '#5B6472', marginTop: 8 },
  notice: { backgroundColor: '#FEF0C7', borderRadius: 10, padding: 12, marginBottom: 12 },
  noticeText: { fontSize: 13, color: '#7A4B00' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E6EC' },
  heading: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 10 },
  dayBlock: { marginTop: 6 },
  dayTitle: { fontSize: 14, fontWeight: '700', color: '#344054', marginBottom: 6, marginTop: 6 },
  meta: { fontSize: 12, color: '#5B6472', marginBottom: 6 },
  entryText: { fontSize: 14, color: '#101828', lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1.5, borderColor: '#D0D5DD', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#FFFFFF' },
  chipOn: { borderColor: '#1D3557', backgroundColor: '#1D3557' },
  chipText: { fontSize: 12, color: '#344054' },
  chipTextOn: { color: '#FFFFFF', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, backgroundColor: '#FFFFFF', marginBottom: 10 },
  button: { backgroundColor: '#1D3557', borderRadius: 10, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 14, marginTop: 6 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondary: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 8, paddingHorizontal: 14 },
  secondaryText: { color: '#344054', fontWeight: '600', fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  disabled: { opacity: 0.6 },
});
"""

EDITS = [
    # Server: mount the Log Book routes.
    ('ysis-backend/src/app.js',
     "const resultsPortalRoutes = require('./routes/resultsPortal.routes');",
     "const resultsPortalRoutes = require('./routes/resultsPortal.routes');\nconst logBookRoutes = require('./routes/logBook.routes');"),
    ('ysis-backend/src/app.js',
     "app.use('/results-portal', resultsPortalRoutes);",
     "app.use('/results-portal', resultsPortalRoutes);\napp.use('/log-entries', logBookRoutes);"),

    # Mobile: register the screen.
    ('ysis-mobile/src/navigation/MoreStack.js',
     "import CreateClassTeacherScreen from '../screens/CreateClassTeacherScreen';\n",
     "import CreateClassTeacherScreen from '../screens/CreateClassTeacherScreen';\nimport LogBookScreen from '../screens/LogBookScreen';\n"),
    ('ysis-mobile/src/navigation/MoreStack.js',
     "const CreateClassTeacherWrapped = withScreenHeader(CreateClassTeacherScreen, 'Add Class Teacher');\n",
     "const CreateClassTeacherWrapped = withScreenHeader(CreateClassTeacherScreen, 'Add Class Teacher');\nconst LogBookWrapped = withScreenHeader(LogBookScreen, 'Log Book');\n"),
    ('ysis-mobile/src/navigation/MoreStack.js',
     "<Stack.Screen\n        name=\"Leavers\"",
     "<Stack.Screen\n        name=\"LogBook\"\n        component={LogBookWrapped}\n        options={{ title: 'Log Book' }}\n      />\n      <Stack.Screen\n        name=\"Leavers\""),

    # Mobile: menu row for everyone except guests.
    ('ysis-mobile/src/screens/MoreScreen.js',
     "onPress={() => navigation.navigate('CreateClassTeacher')}\n          />\n        )}\n",
     "onPress={() => navigation.navigate('CreateClassTeacher')}\n          />\n        )}\n\n        {!isGuest && (\n          <MenuRow\n            icon=\"book\"\n            label=\"Log Book\"\n            subtitle=\"Daily activity in each class\"\n            color={colors.textPrimary}\n            onPress={() => navigation.navigate('LogBook')}\n          />\n        )}\n"),
]

NEW_FILES = {
    'ysis-backend/migrations/027_log_entries.js': MIGRATION,
    'ysis-backend/src/utils/logBookRules.js': RULES,
    'ysis-backend/src/routes/logBook.routes.js': ROUTES,
    'ysis-mobile/src/screens/LogBookScreen.js': SCREEN,
}

MARKER = 'ysis-backend/src/routes/logBook.routes.js'
REQUIRES = [
    'ysis-backend/src/utils/classTeacherRules.js',      # step 2b
    'ysis-mobile/src/screens/ClassTeachersScreen.js',   # step 2c
]
NAME = '3 Log Book (class teachers write for their class, scoped reading, 24-hour corrections)'


def fail(msg):
    sys.exit('STOPPED, nothing was changed.\n' + msg)


def main():
    if not (os.path.isdir('ysis-backend') and os.path.isdir('ysis-mobile')):
        fail('Run this from ~/YALA_SIS (the folder that holds ysis-backend and ysis-mobile).')

    for need in REQUIRES:
        if not os.path.exists(need):
            fail('Apply steps 1d, 2a, 2b and 2c first. Missing: ' + need)

    if os.path.exists(MARKER):
        print('Nothing to do. Step 3 is already applied.')
        return

    for path in NEW_FILES:
        if os.path.exists(path):
            fail('Unexpected existing file: ' + path)

    writes = {}
    for path, anchor, replacement in EDITS:
        if path in writes:
            text = writes[path]
        elif os.path.exists(path):
            text = open(path).read()
        else:
            fail('Missing file: ' + path)
        n = text.count(anchor)
        if n != 1:
            fail('Anchor found %d times (needs exactly 1) in %s\n  starts: %r' % (n, path, anchor[:70]))
        writes[path] = text.replace(anchor, replacement)

    for path, text in NEW_FILES.items():
        writes[path] = text

    for path, text in writes.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            f.write(text)
    print('applied:', NAME)
    print('files written:', len(writes))


main()

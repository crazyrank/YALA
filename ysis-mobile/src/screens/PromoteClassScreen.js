import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDb } from '../db';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';
import { queueOperation } from '../services/syncEngine';
import { CLASS_ORDER, getNextClass } from '../utils/classProgression';
import { nextSession } from '../utils/academicSession';
import { armRuleFor, divisionOfClass } from '../utils/studentRules';

// Safety limits. The server checks every promotion again on its own.
const MAX_PER_RUN = 300;
const PROMOTABLE = ['registered', 'active', 'promoted'];

function sessionOf(s) {
  return s.current_session || s.academic_session || null;
}

export default function PromoteClassScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isAdmin = user?.role === 'principal' || user?.role === 'director';

  const [counts, setCounts] = useState({});
  const [classLevel, setClassLevel] = useState(null);
  const [students, setStudents] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const loadCounts = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync(
        'SELECT class_level, COUNT(*) AS n FROM students GROUP BY class_level'
      );
      const map = {};
      rows.forEach((r) => { map[r.class_level] = Number(r.n) || 0; });
      setCounts(map);
    } catch (e) {
      setCounts({});
    }
  }, []);

  const loadClass = useCallback(async (cls) => {
    setLoading(true);
    try {
      const db = await getDb();
      const rows = await db.getAllAsync(
        `SELECT id, full_name, admission_no, class_level, arm, status, sync_version,
                current_session, academic_session, local_dirty
         FROM students WHERE class_level = ? ORDER BY full_name`,
        [cls]
      );
      setStudents(rows);
      const sessions = [...new Set(rows.map(sessionOf).filter(Boolean))];
      // Only one session in the class: no way to mix up, so it is chosen for you.
      setSession(sessions.length === 1 ? sessions[0] : null);
    } catch (e) {
      setStudents([]);
      setSession(null);
      Alert.alert('Could not load', 'This class could not be read from the phone. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadCounts(); }, [loadCounts]));

  const chooseClass = (cls) => {
    setClassLevel(cls);
    loadClass(cls);
  };

  const nextClass = classLevel ? getNextClass(classLevel) : null;

  const sessionChoices = useMemo(() => {
    const tally = {};
    students.forEach((s) => {
      const x = sessionOf(s);
      if (x) tally[x] = (tally[x] || 0) + 1;
    });
    return Object.keys(tally).sort().map((k) => ({ session: k, count: tally[k] }));
  }, [students]);

  // Who moves and who is left out, with a plain reason for each one left out.
  const plan = useMemo(() => {
    const included = [];
    const leftOut = [];
    let otherSession = 0;
    if (!classLevel || !nextClass || !session) return { included, leftOut, otherSession };
    const rule = armRuleFor(nextClass);

    students.forEach((s) => {
      const sess = sessionOf(s);
      if (!sess) { leftOut.push({ s, why: 'No session recorded' }); return; }
      if (sess !== session) { otherSession += 1; return; }
      if (!PROMOTABLE.includes(s.status)) { leftOut.push({ s, why: 'Status is ' + s.status }); return; }
      if (s.local_dirty) { leftOut.push({ s, why: 'Has changes that have not synced yet' }); return; }

      let arm = null;
      if (rule.required) {
        arm = rule.allowed.find((a) => a.toLowerCase() === String(s.arm || '').toLowerCase()) || null;
        if (!arm) { leftOut.push({ s, why: 'Needs an arm for ' + nextClass + '. Promote from the student page.' }); return; }
      }
      included.push({ s, arm });
    });
    return { included, leftOut, otherSession };
  }, [students, session, classLevel, nextClass]);

  const tooMany = plan.included.length > MAX_PER_RUN;
  const canRun = isAdmin && !running && plan.included.length > 0 && !tooMany;

  const run = async () => {
    if (!canRun || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);

    let done = 0;
    let changedMeanwhile = 0;
    let stoppedEarly = false;
    const advanced = nextSession(session);

    try {
      const db = await getDb();
      const now = new Date().toISOString();

      for (const { s, arm } of plan.included) {
        try {
          await db.withTransactionAsync(async () => {
            const res = await db.runAsync(
              `UPDATE students
               SET class_level = ?, division = ?, arm = ?, status = 'promoted',
                   current_session = COALESCE(?, current_session),
                   sync_version = sync_version + 1, updated_at = ?, local_dirty = 1
               WHERE id = ? AND class_level = ? AND sync_version = ? AND local_dirty = 0`,
              [nextClass, divisionOfClass(nextClass), arm, advanced, now, s.id, classLevel, s.sync_version]
            );
            if (res.changes !== 1) throw new Error('CHANGED_MEANWHILE');
            await queueOperation({
              opType: 'promote_student',
              entityId: s.id,
              payload: { based_on_version: s.sync_version, newClassLevel: nextClass, arm },
            });
          });
          done += 1;
        } catch (err) {
          if (err && err.message === 'CHANGED_MEANWHILE') {
            changedMeanwhile += 1;
          } else {
            stoppedEarly = true;
            break;
          }
        }
      }
    } catch (e) {
      stoppedEarly = true;
    } finally {
      runningRef.current = false;
      setRunning(false);
    }

    let message = done + ' student' + (done === 1 ? '' : 's') + ' moved from ' + classLevel + ' to ' + nextClass + '.';
    if (changedMeanwhile > 0) message += '\n' + changedMeanwhile + ' changed while this was running and were not moved.';
    if (stoppedEarly) message += '\nSomething went wrong, so it stopped. Nothing is lost. Open this page again to see who is left.';
    Alert.alert(stoppedEarly ? 'Stopped' : 'Done', message);

    await loadCounts();
    await loadClass(classLevel);
  };

  const confirm = () => {
    if (!canRun) return;
    const n = plan.included.length;
    Alert.alert(
      'Promote ' + n + ' student' + (n === 1 ? '' : 's') + '?',
      'Everyone listed will move from ' + classLevel + ' to ' + nextClass + '. You can undo a student later from their own page.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Promote ' + n, onPress: run },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Not allowed</Text>
        <Text style={styles.centerText}>Only a Principal or Director can promote a class.</Text>
      </View>
    );
  }

  const promotable = CLASS_ORDER.filter((c) => getNextClass(c) && (counts[c] || 0) > 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Which class is moving up?</Text>
      <Text style={styles.sub}>SS3 students graduate, so they are not listed here.</Text>

      <View style={styles.chipRow}>
        {promotable.length === 0 ? (
          <Text style={styles.sub}>No students are stored on this phone yet.</Text>
        ) : (
          promotable.map((c) => (
            <Pressable
              key={c}
              disabled={running}
              onPress={() => chooseClass(c)}
              style={[styles.chip, classLevel === c && styles.chipOn]}
            >
              <Text style={[styles.chipText, classLevel === c && styles.chipTextOn]}>
                {c} ({counts[c]})
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {loading && <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />}

      {classLevel && !loading && (
        <View style={styles.card}>
          {sessionChoices.length === 0 ? (
            <Text style={styles.warn}>
              None of these students has a session recorded, so this class cannot be promoted together.
              Promote them one by one from their pages.
            </Text>
          ) : sessionChoices.length === 1 ? (
            <Text style={styles.line}>
              Session: {session} moves to {nextSession(session)}
            </Text>
          ) : (
            <View>
              <Text style={styles.label}>Which session is this class finishing?</Text>
              <Text style={styles.sub}>This class has more than one session. Choose the older one.</Text>
              <View style={styles.chipRow}>
                {sessionChoices.map((c) => (
                  <Pressable
                    key={c.session}
                    disabled={running}
                    onPress={() => setSession(c.session)}
                    style={[styles.chip, session === c.session && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, session === c.session && styles.chipTextOn]}>
                      {c.session} ({c.count})
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {session && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.big}>
                {plan.included.length} student{plan.included.length === 1 ? '' : 's'} will move from {classLevel} to {nextClass}
              </Text>

              {plan.otherSession > 0 && (
                <Text style={styles.sub}>
                  {plan.otherSession} from a different session {plan.otherSession === 1 ? 'is' : 'are'} not touched.
                </Text>
              )}

              {tooMany && (
                <Text style={styles.warn}>
                  That is more than {MAX_PER_RUN} students at once, so it is blocked. Check the class and session.
                </Text>
              )}

              {plan.leftOut.length > 0 && (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={styles.label}>Left out ({plan.leftOut.length})</Text>
                  {plan.leftOut.slice(0, 12).map(({ s, why }) => (
                    <View key={s.id} style={styles.leftRow}>
                      <Text style={styles.leftName}>{s.full_name}</Text>
                      <Text style={styles.leftWhy}>{why}</Text>
                    </View>
                  ))}
                  {plan.leftOut.length > 12 && (
                    <Text style={styles.sub}>and {plan.leftOut.length - 12} more.</Text>
                  )}
                </View>
              )}
            </View>
          )}

          <Pressable
            onPress={confirm}
            disabled={!canRun}
            style={({ pressed }) => [styles.button, !canRun && styles.buttonOff, pressed && { opacity: 0.85 }]}
          >
            {running ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.buttonText}>
                {plan.included.length > 0 ? 'Promote ' + plan.included.length + ' to ' + nextClass : 'Nobody to promote'}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
    centerTitle: { ...type.h3, color: colors.textPrimary, marginBottom: spacing.xs },
    centerText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
    heading: { ...type.h3, fontSize: 18, color: colors.textPrimary },
    sub: { ...type.bodySmall, color: colors.textMuted, marginTop: 4 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
    chip: {
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    chipOn: { backgroundColor: colors.inkSoft, borderColor: colors.inkSoft },
    chipText: { ...type.label, fontSize: 13, color: colors.textPrimary },
    chipTextOn: { color: colors.textInverse },
    card: {
      marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    label: { ...type.label, fontSize: 13, color: colors.textPrimary },
    line: { ...type.body, fontSize: 14, color: colors.textPrimary },
    big: { ...type.h3, fontSize: 16, color: colors.textPrimary },
    warn: { ...type.body, fontSize: 13, color: colors.error, marginTop: spacing.sm },
    leftRow: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
    leftName: { ...type.body, fontSize: 14, color: colors.textPrimary },
    leftWhy: { ...type.bodySmall, color: colors.textMuted, marginTop: 2 },
    button: {
      marginTop: spacing.lg, backgroundColor: colors.inkSoft, borderRadius: radius.md,
      paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    },
    buttonOff: { opacity: 0.4 },
    buttonText: { ...type.button, color: colors.textInverse, fontSize: 14 },
  });
}

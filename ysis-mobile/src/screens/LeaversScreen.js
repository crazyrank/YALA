import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { LEAVER_STATUSES, LEAVE_LABELS } from '../utils/leaveStatuses';

// Reads this phone's copy, so it works offline. A Head Teacher's phone only holds
// their own division, so they see only their own leavers.
const PLACEHOLDERS = LEAVER_STATUSES.map(() => '?').join(',');
const SESSION_SQL = 'COALESCE(current_session, academic_session)';

export default function LeaversScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const allowed = ['principal', 'director', 'head_teacher'].includes(user?.role);

  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef(null);

  const load = useCallback(async (wanted) => {
    setLoading(true);
    try {
      const db = await getDb();
      const found = await db.getAllAsync(
        `SELECT DISTINCT ${SESSION_SQL} AS s FROM students
         WHERE status IN (${PLACEHOLDERS}) AND ${SESSION_SQL} IS NOT NULL
         ORDER BY s DESC`,
        LEAVER_STATUSES
      );
      const list = found.map((r) => r.s);
      const chosen = wanted && list.includes(wanted) ? wanted : (list[0] || null);
      sessionRef.current = chosen;
      setSessions(list);
      setSession(chosen);
      if (chosen) {
        const data = await db.getAllAsync(
          `SELECT id, admission_no, full_name, class_level, status FROM students
           WHERE status IN (${PLACEHOLDERS}) AND ${SESSION_SQL} = ?
           ORDER BY full_name ASC`,
          [...LEAVER_STATUSES, chosen]
        );
        setRows(data);
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (allowed) load(sessionRef.current);
  }, [allowed, load]));

  if (!allowed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.body, { color: colors.textMuted }]}>Only school staff can see leavers.</Text>
      </View>
    );
  }

  const groups = LEAVER_STATUSES
    .map((status) => ({ status, items: rows.filter((r) => r.status === status) }))
    .filter((g) => g.items.length > 0);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {loading && <ActivityIndicator style={styles.spinner} color={colors.gold} />}

      {!loading && sessions.length === 0 && (
        <Text style={[styles.body, { color: colors.textMuted }]}>No leavers recorded yet.</Text>
      )}

      {sessions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {sessions.map((s) => {
            const selected = s === session;
            return (
              <Pressable
                key={s}
                onPress={() => load(s)}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: selected ? colors.inkSoft : colors.surface }]}
              >
                <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{s}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {groups.map((g) => (
        <View key={g.status} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>
            {LEAVE_LABELS[g.status]} ({g.items.length})
          </Text>
          {g.items.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => navigation.navigate('StudentDetail', { studentId: s.id })}
              style={[styles.row, { borderTopColor: colors.border }]}
            >
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{s.full_name}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                {s.admission_no || 'No admission number'} · {s.class_level}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  spinner: { marginTop: 14 },
  chips: { gap: 8, paddingBottom: 4 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: fontFamily.bodyBold },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 },
  groupTitle: { fontSize: 15, fontFamily: fontFamily.heading, marginBottom: 6 },
  row: { paddingVertical: 10, borderTopWidth: 1 },
  name: { fontSize: 14, fontFamily: fontFamily.bodyBold },
  meta: { fontSize: 12, marginTop: 2 },
});

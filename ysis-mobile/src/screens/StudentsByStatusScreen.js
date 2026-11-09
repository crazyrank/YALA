import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { useTheme } from '../theme/ThemeContext';

// Status values come from the students table (src/db/schema.js).
const GROUPS = [
  { key: 'active', label: 'Active', statuses: ['registered', 'active', 'promoted'] },
  { key: 'inactive', label: 'Inactive', statuses: ['inactive', 'not_admitted'] },
  { key: 'exited', label: 'Exited', statuses: ['graduated', 'transferred', 'withdrawn', 'expelled', 'archived', 'deceased'] },
];

export default function StudentsByStatusScreen({ navigation }) {
  const { colors } = useTheme();
  const [groupKey, setGroupKey] = useState('active');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ active: 0, inactive: 0, exited: 0 });

  const load = useCallback(async () => {
    const db = await getDb();
    const group = GROUPS.find((g) => g.key === groupKey);
    const marks = group.statuses.map(() => '?').join(',');
    const list = await db.getAllAsync(
      `SELECT id, admission_no, full_name, class_level, arm, status FROM students
       WHERE status IN (${marks}) ORDER BY full_name COLLATE NOCASE LIMIT 500`,
      group.statuses
    );
    setRows(list);

    const next = {};
    for (const g of GROUPS) {
      const m = g.statuses.map(() => '?').join(',');
      const row = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM students WHERE status IN (${m})`, g.statuses);
      next[g.key] = row ? row.n : 0;
    }
    setCounts(next);
  }, [groupKey]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setRows([]));
    }, [load])
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.tabs}>
        {GROUPS.map((g) => {
          const active = g.key === groupKey;
          return (
            <Pressable
              key={g.key}
              onPress={() => setGroupKey(g.key)}
              style={[
                styles.tab,
                { borderColor: colors.border, backgroundColor: active ? colors.gold : colors.surface },
              ]}
            >
              <Text style={[styles.tabText, { color: active ? colors.textInverse : colors.textPrimary }]}>
                {g.label} ({counts[g.key]})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>No students in this group.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.name, { color: colors.textPrimary }]}>{item.full_name}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {item.admission_no} · {item.class_level}
              {item.arm ? ` ${item.arm}` : ''} · {item.status}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  tab: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
  row: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});

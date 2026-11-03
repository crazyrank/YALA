import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../db';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

export default function GuestStudentDetailScreen({ route }) {
  const { colors } = useTheme();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const db = await getDb();
        const row = await db.getFirstAsync(
          'SELECT id, admission_no, full_name, class_level, arm FROM students WHERE id = ?',
          [route?.params?.studentId]
        );
        if (row) await api.post(`/guest-accounts/student-views/${encodeURIComponent(row.id)}`, {});
        if (active) setStudent(row || null);
      } catch { if (active) setStudent(null); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [route?.params?.studentId]);
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  if (!student) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Student record is not available on this device.</Text></View>;
  return <View style={[styles.page, { backgroundColor: colors.background }]}>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.name, { color: colors.textPrimary }]}>{student.full_name}</Text>
      <View style={styles.line}><Text style={[styles.label, { color: colors.textMuted }]}>Registration number</Text><Text style={[styles.value, { color: colors.textPrimary }]}>{student.admission_no}</Text></View>
      <View style={styles.line}><Text style={[styles.label, { color: colors.textMuted }]}>Class</Text><Text style={[styles.value, { color: colors.textPrimary }]}>{student.class_level}{student.arm ? ` ${student.arm}` : ''}</Text></View>
      <Text style={[styles.note, { color: colors.textMuted }]}>Read-only Guest access</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, card: { borderWidth: 1, borderRadius: 18, padding: 18 }, name: { fontSize: 21, fontWeight: '800', marginBottom: 18 }, line: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8DEE8' }, label: { fontSize: 11, marginBottom: 4 }, value: { fontSize: 15, fontWeight: '700' }, note: { fontSize: 11, marginTop: 14 } });

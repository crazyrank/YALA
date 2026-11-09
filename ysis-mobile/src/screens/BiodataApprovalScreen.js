import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { reviewBiodata } from '../services/biodataLocal';
import { APPROVER_ROLES } from '../utils/biodataApproval';

function parseData(text) {
  try {
    return JSON.parse(text || '{}') || {};
  } catch {
    return {};
  }
}

function filledFields(data) {
  return Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .slice(0, 12);
}

export default function BiodataApprovalScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [reasons, setReasons] = useState({});
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const db = await getDb();
    const list = await db.getAllAsync(
      `SELECT b.student_id, b.data_json, b.updated_at, s.full_name, s.admission_no, s.class_level, s.arm
       FROM biodata_local b JOIN students s ON s.id = b.student_id
       WHERE b.approval_status = 'pending' ORDER BY b.updated_at ASC`
    );
    setItems(list.map((r) => ({ ...r, data: parseData(r.data_json) })));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setItems([]));
    }, [load])
  );

  if (!APPROVER_ROLES.includes(user?.role)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          Biodata approval is for head teachers, principals and directors.
        </Text>
      </View>
    );
  }

  const review = async (item, action) => {
    const reason = (reasons[item.student_id] || '').trim();
    if (action === 'return' && !reason) {
      setMessage('Write a reason before returning biodata.');
      return;
    }
    setBusyId(item.student_id);
    setMessage('');
    try {
      const result = await reviewBiodata({
        studentId: item.student_id,
        role: user.role,
        action,
        reason,
      });
      if (result && result.ok === false) {
        setMessage(result.message || 'This review could not be saved.');
      } else {
        await load();
      }
    } catch (err) {
      setMessage(err.message || 'This review could not be saved.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {message ? <Text style={[styles.message, { color: colors.error }]}>{message}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.student_id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>No biodata is waiting for approval.</Text>
        }
        renderItem={({ item }) => {
          const busy = busyId === item.student_id;
          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.name, { color: colors.textPrimary }]}>{item.full_name}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {item.admission_no} · {item.class_level}
                {item.arm ? ` ${item.arm}` : ''}
              </Text>

              {filledFields(item.data).map(([key, value]) => (
                <Text key={key} style={[styles.field, { color: colors.textPrimary }]}>
                  <Text style={{ color: colors.textMuted }}>{key.replace(/_/g, ' ')}: </Text>
                  {String(value)}
                </Text>
              ))}

              <TextInput
                style={[styles.reason, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Reason (required to return)"
                placeholderTextColor={colors.textMuted}
                value={reasons[item.student_id] || ''}
                onChangeText={(text) => setReasons((r) => ({ ...r, [item.student_id]: text }))}
              />

              <View style={styles.actions}>
                <Pressable
                  disabled={busy}
                  onPress={() => review(item, 'return')}
                  style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Return</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() => review(item, 'approve')}
                  style={[styles.button, { borderColor: colors.gold, backgroundColor: colors.gold }]}
                >
                  <Text style={[styles.buttonText, { color: colors.textInverse }]}>
                    {busy ? 'Saving...' : 'Approve'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { paddingHorizontal: 16, paddingTop: 12, fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 4, marginBottom: 8 },
  field: { fontSize: 13, marginTop: 4 },
  reason: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  button: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  buttonText: { fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});

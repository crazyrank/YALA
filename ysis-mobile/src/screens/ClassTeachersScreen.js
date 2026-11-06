import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CLASS_ORDER } from '../utils/classProgression';
import { armRuleFor, armChoicesFor, divisionOfClass } from '../utils/studentRules';

// Each Class Teacher is responsible for exactly one class. The server enforces this too.
const ARMS = ['Science', 'Arts', 'Commercial'];
const DIVISIONS = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
];

export default function ClassTeachersScreen() {
  const { user } = useAuth();
  const canChange = ['director', 'principal', 'head_teacher'].includes(user?.role);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [division, setDivision] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [arm, setArm] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/class-teachers');
      setRows(res?.classTeachers || []);
    } catch (err) {
      Alert.alert(
        'Could not load',
        err?.isNetworkError ? 'Class teachers need an internet connection.' : (err?.message || 'Try again.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = (row) => {
    setEditingId(row.id);
    setDivision(row.division);
    setClassLevel(row.class_level);
    setArm(row.arm || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setArm('');
  };

  const save = async () => {
    if (!division || !classLevel) {
      Alert.alert('Choose a class', 'Pick the division and the one class.');
      return;
    }
    if (armRuleFor(classLevel).required && !arm) {
      Alert.alert('Choose an arm', 'This class needs an arm.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/users/${editingId}/class-teacher-class`, {
        division,
        classLevel,
        arm: arm || undefined,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      Alert.alert('Could not change the class', err?.message || 'Check the class and try again.');
    } finally {
      setSaving(false);
    }
  };

  const classChoices = CLASS_ORDER.filter((c) => divisionOfClass(c) === division);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading && <ActivityIndicator style={styles.spinner} />}

      {!loading && rows.length === 0 && (
        <Text style={styles.body}>No class teachers yet.</Text>
      )}

      {rows.map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.name}>{row.full_name}</Text>
          <Text style={styles.meta}>
            {row.class_level}{row.arm ? ` (${row.arm})` : ''} · {row.division === 'primary' ? 'Primary' : 'Secondary'}
          </Text>

          {canChange && editingId !== row.id && (
            <Pressable style={styles.button} onPress={() => startEdit(row)}>
              <Text style={styles.buttonText}>Change class</Text>
            </Pressable>
          )}

          {editingId === row.id && (
            <View style={styles.editBox}>
              <Text style={styles.label}>Division</Text>
              <View style={styles.chips}>
                {DIVISIONS.map((d) => (
                  <Pressable
                    key={d.key}
                    style={[styles.chip, division === d.key && styles.chipOn]}
                    onPress={() => { setDivision(d.key); setClassLevel(''); setArm(''); }}
                  >
                    <Text style={[styles.chipText, division === d.key && styles.chipTextOn]}>{d.label}</Text>
                  </Pressable>
                ))}
              </View>

              {division !== '' && (
                <>
                  <Text style={styles.label}>Class</Text>
                  <View style={styles.chips}>
                    {classChoices.map((c) => (
                      <Pressable
                        key={c}
                        style={[styles.chip, classLevel === c && styles.chipOn]}
                        onPress={() => { setClassLevel(c); setArm(''); }}
                      >
                        <Text style={[styles.chipText, classLevel === c && styles.chipTextOn]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {classLevel !== '' && (
                <>
                  <Text style={styles.label}>Arm</Text>
                  <View style={styles.chips}>
                    {armChoicesFor(classLevel).map((a) => (
                      <Pressable
                        key={a}
                        style={[styles.chip, arm === a && styles.chipOn]}
                        onPress={() => setArm(a)}
                      >
                        <Text style={[styles.chipText, arm === a && styles.chipTextOn]}>{a}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.actions}>
                <Pressable style={styles.secondary} onPress={cancelEdit} disabled={saving}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save</Text>}
                </Pressable>
              </View>
            </View>
          )}
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
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E6EC' },
  name: { fontSize: 16, fontWeight: '700', color: '#101828' },
  meta: { fontSize: 13, color: '#5B6472', marginTop: 3 },
  button: { backgroundColor: '#1D3557', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 10, paddingHorizontal: 14 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondary: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 10, paddingHorizontal: 14 },
  secondaryText: { color: '#344054', fontWeight: '600', fontSize: 14 },
  editBox: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#E2E6EC', paddingTop: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#344054', marginTop: 10, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: '#D0D5DD', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FFFFFF' },
  chipOn: { borderColor: '#1D3557', backgroundColor: '#1D3557' },
  chipText: { fontSize: 13, color: '#344054' },
  chipTextOn: { color: '#FFFFFF', fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});

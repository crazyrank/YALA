import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { queueOperation } from '../services/syncEngine';

/**
 * Implements the two-step registration flow (Build Spec Section 6):
 * normally a Head Teacher is completing a record the Principal already
 * pre-registered (found via search). This screen is reached either from
 * "+ Register" (a genuinely new student, used mainly by the Principal)
 * OR from the search screen's fallback path when a Head Teacher can't
 * find a name yet and needs to key in the admission number the
 * Principal shared verbally.
 *
 * Either way, this always writes LOCALLY first (local commit first,
 * Principle 2) and queues a sync operation — it never blocks on network.
 */
export default function RegisterStudentScreen({ route, navigation }) {
  const prefillName = route.params?.prefillName || '';
  const [admissionNo, setAdmissionNo] = useState('');
  const [fullName, setFullName] = useState(prefillName);
  const [division, setDivision] = useState('secondary');
  const [classLevel, setClassLevel] = useState('');
  const [arm, setArm] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!admissionNo.trim() || !fullName.trim() || !classLevel.trim()) {
      Alert.alert('Missing details', 'Admission number, name, and class are required.');
      return;
    }

    setSaving(true);
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      const db = await getDb();

      await db.runAsync(
        `INSERT INTO students
           (id, admission_no, full_name, division, class_level, arm, guardian_name, guardian_phone,
            status, sync_version, created_at, updated_at, local_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'registered', 1, ?, ?, 1)`,
        [id, admissionNo.trim(), fullName.trim(), division, classLevel.trim(), arm.trim() || null,
          guardianName.trim() || null, guardianPhone.trim() || null, now, now]
      );

      await queueOperation({
        opType: 'create_student',
        entityId: id,
        payload: {
          id,
          admissionNo: admissionNo.trim(),
          fullName: fullName.trim(),
          division,
          classLevel: classLevel.trim(),
          arm: arm.trim() || null,
          guardianName: guardianName.trim() || null,
          guardianPhone: guardianPhone.trim() || null,
        },
      });

      Alert.alert(
        'Saved',
        'This student has been saved on your device and will sync automatically when you\'re online.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Could not save', err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Register Student</Text>
      <Text style={styles.hint}>
        If the Principal already gave you an admission number for this student verbally, enter it exactly as given —
        the system will reconcile it automatically once both records sync.
      </Text>

      <Field label="Admission Number *" value={admissionNo} onChangeText={setAdmissionNo} placeholder="e.g. YAL/2026/0142" />
      <Field label="Full Name *" value={fullName} onChangeText={setFullName} placeholder="Student's full name" />

      <Text style={styles.label}>Division *</Text>
      <View style={styles.segmentRow}>
        {['primary', 'secondary'].map((d) => (
          <Pressable
            key={d}
            style={[styles.segment, division === d && styles.segmentActive]}
            onPress={() => setDivision(d)}
          >
            <Text style={[styles.segmentText, division === d && styles.segmentTextActive]}>
              {d === 'primary' ? 'Primary' : 'Secondary'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field label="Class Level *" value={classLevel} onChangeText={setClassLevel} placeholder="e.g. SS2 or Primary 4" />
      <Field label="Arm (secondary only)" value={arm} onChangeText={setArm} placeholder="e.g. Science" />
      <Field label="Guardian Name" value={guardianName} onChangeText={setGuardianName} placeholder="Optional" />
      <Field label="Guardian Phone" value={guardianPhone} onChangeText={setGuardianPhone} placeholder="Optional" keyboardType="phone-pad" />

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Student'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: '#16324f', marginBottom: 6 },
  hint: { fontSize: 12, color: '#7a8a99', lineHeight: 17, marginBottom: 20 },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#16324f', marginBottom: 6 },
  input: { backgroundColor: '#f4f2ec', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  segment: { flex: 1, backgroundColor: '#f4f2ec', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: '#16324f' },
  segmentText: { color: '#16324f', fontWeight: '600', fontSize: 12.5 },
  segmentTextActive: { color: '#fff' },
  button: { backgroundColor: '#c9a24b', paddingVertical: 14, borderRadius: 8, marginTop: 10 },
  buttonText: { textAlign: 'center', color: '#0d1f33', fontWeight: '700', fontSize: 15 },
});

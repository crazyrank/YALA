import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { useAuth } from '../context/AuthContext';
import { queueOperation } from '../services/syncEngine';
import { getNextClass, isAtMaxClass } from '../utils/classProgression';

export default function StudentDetailScreen({ route, navigation }) {
  const { studentId } = route.params;
  const { user } = useAuth();

  const [student, setStudent] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [promoting, setPromoting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editArm, setEditArm] = useState('');
  const [editGuardian, setEditGuardian] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const isAdmin =
    user?.role === 'principal' || user?.role === 'director';

  const loadStudent = useCallback(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync(
      'SELECT * FROM students WHERE id = ?',
      [studentId]
    );
    setStudent(row);
    if (row) {
      setEditName(row.full_name || '');
      setEditClass(row.class_level || '');
      setEditArm(row.arm || '');
      setEditGuardian(row.guardian_name || '');
      setEditPhone(row.guardian_phone || '');
    }
    if (row?.merged_notice_pending) {
      Alert.alert(
        'Record Updated',
        'This student’s record was reconciled by the Principal after being entered on two devices. The details shown now are the confirmed, correct version.',
        [{
          text: 'OK',
          onPress: async () => {
            await db.runAsync(
              'UPDATE students SET merged_notice_pending = 0 WHERE id = ?',
              [studentId]
            );
          },
        }]
      );
    }
    const photo = await db.getFirstAsync(
      'SELECT * FROM student_photos WHERE student_id = ? AND is_current = 1',
      [studentId]
    );
    setPhotoUri(photo?.local_uri || photo?.storage_url || null);
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      loadStudent();
    }, [loadStudent])
  );

  const handleCapturePhoto = () => {
    if (photoUri && !isAdmin) {
      Alert.alert(
        'Photo already on file',
        'This student already has a passport photo. If it needs to be corrected, ask your Principal.'
      );
      return;
    }
    if (photoUri && isAdmin) {
      setShowCorrectionInput(true);
      return;
    }
    navigation.navigate('CameraCapture', {
      studentId,
      isCorrection: false,
    });
  };

  const handleConfirmCorrection = () => {
    if (correctionReason.trim().length < 5) {
      Alert.alert('Reason needed', 'Please explain why this photo needs to be replaced.');
      return;
    }
    setShowCorrectionInput(false);
    navigation.navigate('CameraCapture', {
      studentId,
      isCorrection: true,
      correctionReason: correctionReason.trim(),
    });
    setCorrectionReason('');
  };

  const handlePromote = () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can promote students.');
      return;
    }
    const nextClass = getNextClass(student.class_level);
    if (!nextClass) return;
    Alert.alert(
      'Promote student',
      `Move ${student.full_name} from ${student.class_level} to ${nextClass}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            setPromoting(true);
            try {
              const db = await getDb();
              const now = new Date().toISOString();
              const basedOnVersion = student.sync_version;
              await db.runAsync(
                `UPDATE students
                 SET class_level = ?, status = 'promoted', sync_version = sync_version + 1,
                     updated_at = ?, local_dirty = 1
                 WHERE id = ?`,
                [nextClass, now, studentId]
              );
              await queueOperation({
                opType: 'promote_student',
                entityId: studentId,
                payload: {
                  based_on_version: basedOnVersion,
                  changes: { class_level: nextClass, status: 'promoted' },
                },
              });
              await loadStudent();
            } catch (error) {
              Alert.alert('Could not promote', 'Something went wrong saving this promotion.');
            } finally {
              setPromoting(false);
            }
          },
        },
      ]
    );
  };

  const startEditing = () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can edit student records.');
      return;
    }
    setEditName(student.full_name || '');
    setEditClass(student.class_level || '');
    setEditArm(student.arm || '');
    setEditGuardian(student.guardian_name || '');
    setEditPhone(student.guardian_phone || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditName(student.full_name || '');
    setEditClass(student.class_level || '');
    setEditArm(student.arm || '');
    setEditGuardian(student.guardian_name || '');
    setEditPhone(student.guardian_phone || '');
  };

  const handleSaveEdit = async () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can edit student records.');
      return;
    }
    if (!editName.trim() || !editClass.trim()) {
      Alert.alert('Missing details', 'Student name and class are required.');
      return;
    }
    setSaving(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const basedOnVersion = student.sync_version;
      const changes = {
        full_name: editName.trim(),
        class_level: editClass.trim(),
        arm: editArm.trim() || null,
        guardian_name: editGuardian.trim() || null,
        guardian_phone: editPhone.trim() || null,
      };
      await db.runAsync(
        `UPDATE students
         SET full_name = ?, class_level = ?, arm = ?, guardian_name = ?, guardian_phone = ?,
             sync_version = sync_version + 1, updated_at = ?, local_dirty = 1
         WHERE id = ?`,
        [
          changes.full_name,
          changes.class_level,
          changes.arm,
          changes.guardian_name,
          changes.guardian_phone,
          now,
          studentId,
        ]
      );
      await queueOperation({
        opType: 'edit_student',
        entityId: studentId,
        payload: { based_on_version: basedOnVersion, changes },
      });
      setEditing(false);
      await loadStudent();
      Alert.alert('Saved', 'Student record updated on this device.');
    } catch (err) {
      Alert.alert('Could not save', err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can archive students.');
      return;
    }
    if (student.status === 'archived') {
      Alert.alert('Already archived', 'This student is already archived.');
      return;
    }
    Alert.alert(
      'Archive student',
      `Archive ${student.full_name}? Soft delete — record is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDb();
              const now = new Date().toISOString();
              const basedOnVersion = student.sync_version;
              await db.runAsync(
                `UPDATE students
                 SET status = 'archived', sync_version = sync_version + 1,
                     updated_at = ?, local_dirty = 1
                 WHERE id = ?`,
                [now, studentId]
              );
              await queueOperation({
                opType: 'edit_student',
                entityId: studentId,
                payload: {
                  based_on_version: basedOnVersion,
                  changes: { status: 'archived' },
                },
              });
              await loadStudent();
              Alert.alert('Archived', 'Student archived on this device.');
            } catch (err) {
              Alert.alert('Could not archive', err.message || 'Something went wrong.');
            }
          },
        },
      ]
    );
  };

  const handleRestore = () => {
    if (!isAdmin) return;
    Alert.alert(
      'Restore student',
      `Restore ${student.full_name} to active?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              const db = await getDb();
              const now = new Date().toISOString();
              const basedOnVersion = student.sync_version;
              await db.runAsync(
                `UPDATE students
                 SET status = 'active', sync_version = sync_version + 1,
                     updated_at = ?, local_dirty = 1
                 WHERE id = ?`,
                [now, studentId]
              );
              await queueOperation({
                opType: 'edit_student',
                entityId: studentId,
                payload: {
                  based_on_version: basedOnVersion,
                  changes: { status: 'active' },
                },
              });
              await loadStudent();
              Alert.alert('Restored', 'Student is active again on this device.');
            } catch (err) {
              Alert.alert('Could not restore', err.message || 'Something went wrong.');
            }
          },
        },
      ]
    );
  };

  if (!student) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading student...</Text>
      </View>
    );
  }

  const status = student.status || 'active';
  const isArchived = status === 'archived';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.profileCard}>
        <View style={styles.photoWrapper}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <Pressable style={styles.photoPlaceholder} onPress={handleCapturePhoto}>
              <Text style={styles.photoIcon}>+</Text>
              <Text style={styles.photoPlaceholderText}>Add photo</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.name}>{student.full_name}</Text>
        <Text style={styles.admissionNo}>{student.admission_no}</Text>
        <View style={[styles.statusBadge, isArchived && styles.statusBadgeArchived]}>
          <View style={[styles.statusDot, isArchived && styles.statusDotArchived]} />
          <Text style={[styles.statusText, isArchived && styles.statusTextArchived]}>
            {status.toUpperCase()}
          </Text>
        </View>
        {photoUri && (
          <Pressable style={styles.photoAction} onPress={handleCapturePhoto}>
            <Text style={styles.photoActionText}>
              {isAdmin ? 'Replace passport photo' : 'Photo on file'}
            </Text>
          </Pressable>
        )}
      </View>

      {showCorrectionInput && (
        <View style={styles.correctionBox}>
          <Text style={styles.sectionEyebrow}>PHOTO CORRECTION</Text>
          <Text style={styles.correctionTitle}>Why should this photo be replaced?</Text>
          <TextInput
            style={styles.correctionInput}
            placeholder="e.g. Wrong student's photo was uploaded"
            placeholderTextColor="#98A2B3"
            value={correctionReason}
            onChangeText={setCorrectionReason}
            multiline
          />
          <View style={styles.correctionActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setShowCorrectionInput(false);
                setCorrectionReason('');
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.continueButton} onPress={handleConfirmCorrection}>
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isAdmin && !editing && (
        <View style={styles.adminBar}>
          <Pressable style={styles.adminBtn} onPress={startEditing}>
            <Text style={styles.adminBtnText}>Edit</Text>
          </Pressable>
          {isArchived ? (
            <Pressable style={[styles.adminBtn, styles.adminBtnRestore]} onPress={handleRestore}>
              <Text style={[styles.adminBtnText, styles.adminBtnTextDark]}>Restore</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.adminBtn, styles.adminBtnDanger]} onPress={handleArchive}>
              <Text style={styles.adminBtnText}>Archive</Text>
            </Pressable>
          )}
        </View>
      )}

      {isAdmin && editing && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>EDIT RECORD</Text>
          <View style={styles.infoCard}>
            <Text style={styles.fieldLabel}>Full name *</Text>
            <TextInput style={styles.fieldInput} value={editName} onChangeText={setEditName} placeholder="Student full name" placeholderTextColor="#98A2B3" />
            <Text style={styles.fieldLabel}>Class *</Text>
            <TextInput style={styles.fieldInput} value={editClass} onChangeText={setEditClass} placeholder="e.g. SS1" placeholderTextColor="#98A2B3" autoCapitalize="characters" />
            <Text style={styles.fieldLabel}>Arm</Text>
            <TextInput style={styles.fieldInput} value={editArm} onChangeText={setEditArm} placeholder="e.g. A" placeholderTextColor="#98A2B3" />
            <Text style={styles.fieldLabel}>Guardian name</Text>
            <TextInput style={styles.fieldInput} value={editGuardian} onChangeText={setEditGuardian} placeholder="Guardian full name" placeholderTextColor="#98A2B3" />
            <Text style={styles.fieldLabel}>Guardian phone</Text>
            <TextInput style={[styles.fieldInput, styles.fieldInputLast]} value={editPhone} onChangeText={setEditPhone} placeholder="Phone number" placeholderTextColor="#98A2B3" keyboardType="phone-pad" />
          </View>
          <View style={styles.editActions}>
            <Pressable style={styles.cancelButton} onPress={cancelEditing} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.continueButton} onPress={handleSaveEdit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.continueText}>Save changes</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {!editing && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>ACADEMIC INFORMATION</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Class" value={student.class_level || '—'} />
            <InfoRow label="Arm" value={student.arm || '—'} />
            <InfoRow label="Division" value={student.division || 'Secondary'} last />
          </View>
        </View>
      )}

      {isAdmin && !editing && !isArchived && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>PROMOTION</Text>
          <View style={styles.infoCard}>
            {isAtMaxClass(student.class_level) ? (
              <View style={styles.promoteRow}>
                <Text style={styles.maxClassText}>Highest class reached (SS3)</Text>
              </View>
            ) : (
              <Pressable style={styles.promoteButton} onPress={handlePromote} disabled={promoting}>
                <Text style={styles.promoteButtonText}>
                  {promoting ? 'Promoting…' : `Promote to ${getNextClass(student.class_level) || 'next class'}`}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {!editing && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>GUARDIAN INFORMATION</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Guardian" value={student.guardian_name || '—'} />
            <InfoRow label="Phone" value={student.guardian_phone || '—'} last />
          </View>
        </View>
      )}

      {student.local_dirty === 1 && (
        <View style={styles.syncNotice}>
          <View style={styles.syncIcon}><Text style={styles.syncIconText}>!</Text></View>
          <View style={styles.syncContent}>
            <Text style={styles.syncTitle}>Changes waiting to sync</Text>
            <Text style={styles.syncText}>Local changes will sync when the backend is available.</Text>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>YALA • Yalamatrix Schools</Text>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F9' },
  content: { padding: 18, paddingBottom: 35 },
  loading: { flex: 1, backgroundColor: '#F6F7F9', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#667085', fontSize: 13 },
  profileCard: {
    backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1,
    borderColor: '#EAECF0', padding: 22, alignItems: 'center',
  },
  photoWrapper: { marginBottom: 14 },
  photo: { width: 132, height: 132, borderRadius: 66, backgroundColor: '#F2F4F7', borderWidth: 4, borderColor: '#F2F4F7' },
  photoPlaceholder: {
    width: 132, height: 132, borderRadius: 66, backgroundColor: '#F2F4F7',
    borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center',
  },
  photoIcon: { fontSize: 28, fontWeight: '300', color: '#667085' },
  photoPlaceholderText: { marginTop: 2, fontSize: 10, color: '#667085', fontWeight: '600' },
  name: { fontSize: 20, fontWeight: '700', color: '#0A1930', textAlign: 'center' },
  admissionNo: { marginTop: 4, fontSize: 13, color: '#667085' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7F6EF',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12,
  },
  statusBadgeArchived: { backgroundColor: '#F2F4F7' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#12805C', marginRight: 6 },
  statusDotArchived: { backgroundColor: '#667085' },
  statusText: { fontSize: 10, fontWeight: '700', color: '#12805C', letterSpacing: 0.4 },
  statusTextArchived: { color: '#667085' },
  photoAction: { marginTop: 12 },
  photoActionText: { fontSize: 12, fontWeight: '600', color: '#16324F' },
  adminBar: { flexDirection: 'row', marginTop: 14, gap: 10 },
  adminBtn: {
    flex: 1, height: 46, borderRadius: 12, backgroundColor: '#16324F',
    alignItems: 'center', justifyContent: 'center',
  },
  adminBtnDanger: { backgroundColor: '#C0392B' },
  adminBtnRestore: { backgroundColor: '#E7F6EF', borderWidth: 1, borderColor: '#12805C' },
  adminBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  adminBtnTextDark: { color: '#12805C' },
  section: { marginTop: 18 },
  sectionEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#98A2B3', marginBottom: 8 },
  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1,
    borderColor: '#EAECF0', paddingHorizontal: 16, paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F2F4F7',
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 13, color: '#667085' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#0A1930', maxWidth: '60%', textAlign: 'right' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#667085', marginTop: 12, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, color: '#0A1930', backgroundColor: '#FAFBFC',
  },
  fieldInputLast: { marginBottom: 12 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 },
  correctionBox: {
    marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#EAECF0', padding: 16,
  },
  correctionTitle: { fontSize: 14, fontWeight: '600', color: '#0A1930', marginBottom: 10 },
  correctionInput: {
    borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 12,
    minHeight: 72, textAlignVertical: 'top', fontSize: 14, color: '#0A1930',
  },
  correctionActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F2F4F7' },
  cancelText: { fontWeight: '600', color: '#667085', fontSize: 13 },
  continueButton: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#16324F', minWidth: 100, alignItems: 'center',
  },
  continueText: { fontWeight: '700', color: '#FFFFFF', fontSize: 13 },
  promoteRow: { paddingVertical: 14 },
  maxClassText: { fontSize: 13, color: '#667085' },
  promoteButton: {
    backgroundColor: '#C9A24B', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginVertical: 8,
  },
  promoteButtonText: { fontWeight: '700', color: '#0A1930', fontSize: 14 },
  syncNotice: {
    flexDirection: 'row', marginTop: 18, backgroundColor: '#FEF3E2',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F5D9A8',
  },
  syncIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#B7791F',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  syncIconText: { color: '#fff', fontWeight: '700' },
  syncContent: { flex: 1 },
  syncTitle: { fontWeight: '700', fontSize: 13, color: '#0A1930' },
  syncText: { marginTop: 4, fontSize: 12, color: '#667085', lineHeight: 17 },
  footer: { marginTop: 28, alignItems: 'center' },
  footerText: { fontSize: 11, color: '#98A2B3' },
});

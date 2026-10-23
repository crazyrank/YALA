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
import { exportStudentToPdf } from '../services/studentPdfExport';

// Arms exist only for SS2 and SS3. Must match the server rules exactly.
const ARMS = ['Science', 'Arts', 'Commercial'];
const ARM_CLASSES = ['SS2', 'SS3'];

function armRequiredFor(classLevel) {
  return ARM_CLASSES.includes(classLevel);
}

function divisionOfClass(classLevel) {
  return /^(KG|Primary)/.test(classLevel) ? 'primary' : 'secondary';
}

export default function StudentDetailScreen({ route, navigation }) {
  const { studentId } = route.params;
  const { user } = useAuth();

  const [student, setStudent] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  const [promoting, setPromoting] = useState(false);
  const [showPromoteChoice, setShowPromoteChoice] = useState(false);
  const [promoteArm, setPromoteArm] = useState('');

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editArm, setEditArm] = useState('');
  const [editGuardian, setEditGuardian] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const isAdmin =
    user?.role === 'principal' || user?.role === 'director';

  const canExportPdf =
    user?.role === 'principal' ||
    user?.role === 'director' ||
    user?.role === 'head_teacher';

  const loadStudent = useCallback(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync(
      'SELECT * FROM students WHERE id = ?',
      [studentId]
    );
    setStudent(row);
    if (row) {
      setEditName(row.full_name || '');
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

  // Promotion: the arm is chosen here when the next class needs one.
  const performPromotion = async (arm) => {
    const nextClass = getNextClass(student.class_level);
    setPromoting(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const basedOnVersion = student.sync_version;
      await db.runAsync(
        `UPDATE students
         SET class_level = ?, division = ?, arm = ?, status = 'promoted',
             sync_version = sync_version + 1, updated_at = ?, local_dirty = 1
         WHERE id = ?`,
        [nextClass, divisionOfClass(nextClass), arm, now, studentId]
      );
      await queueOperation({
        opType: 'promote_student',
        entityId: studentId,
        payload: {
          based_on_version: basedOnVersion,
          newClassLevel: nextClass,
          arm,
        },
      });
      setShowPromoteChoice(false);
      setPromoteArm('');
      await loadStudent();
    } catch (error) {
      Alert.alert('Could not promote', 'Something went wrong saving this promotion.');
    } finally {
      setPromoting(false);
    }
  };

  const handlePromote = () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can promote students.');
      return;
    }
    const nextClass = getNextClass(student.class_level);
    if (!nextClass) return;

    if (armRequiredFor(nextClass)) {
      setPromoteArm('');
      setShowPromoteChoice(true);
      return;
    }

    Alert.alert(
      'Promote student',
      `Move ${student.full_name} from ${student.class_level} to ${nextClass}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Promote', onPress: () => performPromotion(null) },
      ]
    );
  };

  const confirmPromoteWithArm = () => {
    const nextClass = getNextClass(student.class_level);
    if (!promoteArm) {
      Alert.alert('Choose an arm', `Select Science, Arts, or Commercial for ${nextClass}.`);
      return;
    }
    Alert.alert(
      'Promote student',
      `Move ${student.full_name} from ${student.class_level} to \( {nextClass} ( \){promoteArm})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Promote', onPress: () => performPromotion(promoteArm) },
      ]
    );
  };

  const cancelPromoteChoice = () => {
    setShowPromoteChoice(false);
    setPromoteArm('');
  };

  const startEditing = () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can edit student records.');
      return;
    }
    setEditName(student.full_name || '');
    setEditArm(student.arm || '');
    setEditGuardian(student.guardian_name || '');
    setEditPhone(student.guardian_phone || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditName(student.full_name || '');
    setEditArm(student.arm || '');
    setEditGuardian(student.guardian_name || '');
    setEditPhone(student.guardian_phone || '');
  };

  const handleSaveEdit = async () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can edit student records.');
      return;
    }
    if (!editName.trim()) {
      Alert.alert('Missing details', 'Student name is required.');
      return;
    }
    const needsArm = armRequiredFor(student.class_level);
    if (needsArm && !editArm) {
      Alert.alert('Missing arm', `Choose an arm for ${student.class_level}.`);
      return;
    }

    setSaving(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const basedOnVersion = student.sync_version;

      const changes = {
        full_name: editName.trim(),
        guardian_name: editGuardian.trim() || null,
        guardian_phone: editPhone.trim() || null,
      };
      if (needsArm) changes.arm = editArm;

      const nextArm = needsArm ? editArm : student.arm;

      await db.runAsync(
        `UPDATE students
         SET full_name = ?, arm = ?, guardian_name = ?, guardian_phone = ?,
             sync_version = sync_version + 1, updated_at = ?, local_dirty = 1
         WHERE id = ?`,
        [
          changes.full_name,
          nextArm,
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
      `Archive ${student.full_name}? This is a soft delete. The record is kept.`,
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

  const handleExportPdf = async () => {
    if (!canExportPdf) {
      Alert.alert(
        'Not allowed',
        'Only a Principal, Director or Head Teacher can export a student PDF.'
      );
      return;
    }
    setExportingPdf(true);
    try {
      const ok = await exportStudentToPdf(studentId);
      if (!ok) {
        Alert.alert(
          'Export failed',
          'Student record could not be found on this device.'
        );
      }
    } catch (err) {
      Alert.alert(
        'Export failed',
        err.message || 'Could not create the PDF.'
      );
    } finally {
      setExportingPdf(false);
    }
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
  const nextClass = getNextClass(student.class_level);
  const editNeedsArm = armRequiredFor(student.class_level);

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
          <Text style={styles.correctionTitle}>Why does this photo need to be replaced?</Text>
          <TextInput
            style={styles.correctionInput}
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

            <Text style={styles.fieldLabel}>Class</Text>
            <Text style={styles.classReadOnly}>{student.class_level || '-'}</Text>
            <Text style={styles.editNote}>Class changes only through promotion.</Text>

            {editNeedsArm && (
              <>
                <Text style={styles.fieldLabel}>Arm *</Text>
                {ARMS.map((a) => (
                  <ArmOption key={a} label={a} selected={editArm === a} onPress={() => setEditArm(a)} />
                ))}
              </>
            )}

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
            <InfoRow label="Class" value={student.class_level || '-'} />
            <InfoRow label="Arm" value={student.arm || 'None'} />
            <InfoRow label="Division" value={student.division || 'Secondary'} />
            <InfoRow label="Session" value={student.academic_session || 'Not recorded'} last />
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
            ) : showPromoteChoice ? (
              <View style={styles.promoteChoice}>
                <Text style={styles.fieldLabel}>Choose the arm for {nextClass}</Text>
                {ARMS.map((a) => (
                  <ArmOption key={a} label={a} selected={promoteArm === a} onPress={() => setPromoteArm(a)} />
                ))}
                <View style={styles.editActions}>
                  <Pressable style={styles.cancelButton} onPress={cancelPromoteChoice} disabled={promoting}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.continueButton, !promoteArm && styles.disabledButton]}
                    onPress={confirmPromoteWithArm}
                    disabled={promoting || !promoteArm}
                  >
                    {promoting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.continueText}>Continue</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.promoteButton} onPress={handlePromote} disabled={promoting}>
                <Text style={styles.promoteButtonText}>
                  {promoting ? 'Promoting…' : `Promote to ${nextClass || 'next class'}`}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {canExportPdf && !editing && (
        <View style={styles.section}>
          <Pressable
            style={styles.exportPdfButton}
            onPress={handleExportPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? (
              <ActivityIndicator color="#0A1930" size="small" />
            ) : (
              <Text style={styles.exportPdfButtonText}>Export to PDF for printing</Text>
            )}
          </Pressable>
        </View>
      )}

      {!editing && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>GUARDIAN INFORMATION</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Guardian" value={student.guardian_name || '-'} />
            <InfoRow label="Phone" value={student.guardian_phone || '-'} last />
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

function ArmOption({ label, selected, onPress }) {
  return (
    <Pressable
      style={[styles.armOption, selected && styles.armOptionSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      <Text style={styles.armOptionText}>{label}</Text>
    </Pressable>
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
  photoIcon: { fontSize: 28, color: '#98A2B3', fontWeight: '300' },
  photoPlaceholderText: { fontSize: 11, color: '#98A2B3', marginTop: 4 },
  name: { fontSize: 20, fontWeight: '700', color: '#0A1930', textAlign: 'center' },
  admissionNo: { fontSize: 13, color: '#667085', marginTop: 4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
    backgroundColor: '#E7F6EF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  statusBadgeArchived: { backgroundColor: '#FDECEA' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#12805C', marginRight: 6 },
  statusDotArchived: { backgroundColor: '#C0392B' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#12805C', letterSpacing: 0.5 },
  statusTextArchived: { color: '#C0392B' },
  photoAction: { marginTop: 12 },
  photoActionText: { fontSize: 13, color: '#16324F', fontWeight: '600' },
  adminBar: {
    flexDirection: 'row', marginTop: 16, gap: 10,
  },
  adminBtn: {
    flex: 1, backgroundColor: '#16324F', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  adminBtnDanger: { backgroundColor: '#C0392B' },
  adminBtnRestore: { backgroundColor: '#E7F6EF' },
  adminBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  adminBtnTextDark: { color: '#12805C' },
  section: { marginTop: 18 },
  sectionEyebrow: {
    fontSize: 11, fontWeight: '700', color: '#98A2B3',
    letterSpacing: 1, marginBottom: 8,
  },
  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1,
    borderColor: '#EAECF0', paddingHorizontal: 16, paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2F4F7',
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 13, color: '#667085' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#0A1930', maxWidth: '60%', textAlign: 'right' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#667085', marginTop: 12, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0A1930',
  },
  fieldInputLast: { marginBottom: 8 },
  classReadOnly: { fontSize: 14, fontWeight: '600', color: '#0A1930', marginBottom: 4 },
  editNote: { fontSize: 11, color: '#98A2B3', marginBottom: 4 },
  armOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 8, borderRadius: 10, marginBottom: 4,
  },
  armOptionSelected: { borderWidth: 1, borderColor: '#16324F', backgroundColor: '#EEF3F9' },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#98A2B3',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  radioOuterSelected: { borderColor: '#16324F' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16324F' },
  armOptionText: { fontSize: 15, color: '#0A1930', fontWeight: '600' },
  promoteChoice: { paddingVertical: 8 },
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
  disabledButton: { backgroundColor: '#98A2B3' },
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
  exportPdfButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  exportPdfButtonText: {
    fontWeight: '700',
    color: '#0A1930',
    fontSize: 14,
  },
});

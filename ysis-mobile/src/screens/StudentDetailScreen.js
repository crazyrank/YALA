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
import { api } from '../api/client';
import { getNextClass, isAtMaxClass, getPreviousClass } from '../utils/classProgression';
import { nextSession, previousSession, sessionIsAfter } from '../utils/academicSession';
import { exportStudentToPdf } from '../services/studentPdfExport';
import { dobToIso, isoToDob, formatDobInput } from '../utils/dobFormat';
import { checkRegistration, formatErrors } from '../services/registrationGuard';
import { LEAVER_STATUSES, LEAVABLE_STATUSES, LEAVE_LABELS, leaveOptionsFor } from '../utils/leaveStatuses';
import { approvalOf, approvalNotice, canApproveRecords } from '../utils/approvalStatus';
import StudentBiodataSection from '../components/StudentBiodataSection';

// Arms exist only for SS2 and SS3. Must match the server rules exactly.
const ARMS = ['Science', 'Arts', 'Commercial'];
const ARM_CLASSES = ['SS2', 'SS3'];

function armRequiredFor(classLevel) {
  return ARM_CLASSES.includes(classLevel);
}

function divisionOfClass(classLevel) {
  return /^(Creche|KG|Primary)/.test(classLevel) ? 'primary' : 'secondary';
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
  const [recordingOutcome, setRecordingOutcome] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [savingLeave, setSavingLeave] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editArm, setEditArm] = useState('');
  const [editGuardian, setEditGuardian] = useState('');
  const [editAdmissionNo, setEditAdmissionNo] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const isAdmin =
    user?.role === 'principal' || user?.role === 'director';
  const canEdit =
    isAdmin ||
    user?.role === 'head_teacher' ||
    (user?.role === 'class_teacher' && approvalOf(student) !== 'approved');

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
  // Also advances current_session by one year (registered session stays fixed).
  const performPromotion = async (arm) => {
    const nextClass = getNextClass(student.class_level);
    setPromoting(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const basedOnVersion = student.sync_version;
      const baseSession = student.current_session || student.academic_session || null;
      const advancedSession = baseSession ? nextSession(baseSession) : null;
      await db.runAsync(
        `UPDATE students
         SET class_level = ?, division = ?, arm = ?, status = 'promoted',
             current_session = COALESCE(?, current_session),
             sync_version = sync_version + 1, updated_at = ?, local_dirty = 1
         WHERE id = ?`,
        [nextClass, divisionOfClass(nextClass), arm, advancedSession, now, studentId]
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

  // Entrance result for Primary 5 pupils. Entered by hand, online only: the server
  // is the source of truth and checks the role, the class and the record version.
  const recordOutcome = (outcome) => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can record an entrance result.');
      return;
    }
    if (student.local_dirty) {
      Alert.alert('Sync first', 'This student has changes that have not synced yet. Sync, then record the result.');
      return;
    }
    const label = outcome === 'admitted' ? 'Admitted' : 'Not Admitted';
    Alert.alert(
      'Record entrance result',
      `Record ${student.full_name} as ${label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record',
          onPress: async () => {
            setRecordingOutcome(true);
            try {
              const res = await api.post(`/students/${studentId}/entrance-outcome`, {
                outcome,
                basedOnVersion: student.sync_version,
              });
              const db = await getDb();
              await db.runAsync(
                'UPDATE students SET entrance_outcome = ?, sync_version = ?, updated_at = ? WHERE id = ? AND local_dirty = 0',
                [outcome, res?.student?.sync_version ?? student.sync_version, new Date().toISOString(), studentId]
              );
              await loadStudent();
            } catch (err) {
              Alert.alert(
                'Could not record result',
                err?.code === 'CONFLICT_VERSION_MISMATCH'
                  ? 'This record changed. Sync and try again.'
                  : (err?.message || 'Check your connection and try again.')
              );
            } finally {
              setRecordingOutcome(false);
            }
          },
        },
      ]
    );
  };

  // Record that this student has left. Online only: the server checks the role,
  // the class rules and the record version, and saves the status and the leave
  // record together.
  const submitLeave = () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can record a leave.');
      return;
    }
    if (!leaveType) {
      Alert.alert('Choose a type', 'Choose why this student is leaving.');
      return;
    }
    if (student.local_dirty) {
      Alert.alert('Sync first', 'This student has changes that have not synced yet. Sync, then record the leave.');
      return;
    }
    Alert.alert(
      'Record leave',
      `Record ${student.full_name} as ${LEAVE_LABELS[leaveType]}? This cannot be undone from the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record',
          style: 'destructive',
          onPress: async () => {
            setSavingLeave(true);
            try {
              const res = await api.post(`/students/${studentId}/leave`, {
                leaveType,
                reason: leaveReason.trim() || undefined,
                basedOnVersion: student.sync_version,
              });
              try {
                const db = await getDb();
                await db.runAsync(
                  'UPDATE students SET status = ?, sync_version = ?, updated_at = ? WHERE id = ? AND local_dirty = 0',
                  [leaveType, res?.student?.sync_version ?? student.sync_version, new Date().toISOString(), studentId]
                );
              } catch {
                // The server has saved it. The next sync brings the new status to this phone.
              }
              setLeaveOpen(false);
              setLeaveType('');
              setLeaveReason('');
              await loadStudent();
            } catch (err) {
              Alert.alert(
                'Could not record leave',
                err?.code === 'CONFLICT_VERSION_MISMATCH'
                  ? 'This record changed. Sync and try again.'
                  : (err?.message || 'Check your connection and try again.')
              );
            } finally {
              setSavingLeave(false);
            }
          },
        },
      ]
    );
  };

  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [inactiveReason, setInactiveReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  // Applies a status change made on the server to this phone, the same way a recorded leave is applied.
  const applyLocalStatus = async (status, version) => {
    try {
      const db = await getDb();
      await db.runAsync(
        'UPDATE students SET status = ?, sync_version = ?, updated_at = ? WHERE id = ? AND local_dirty = 0',
        [status, version, new Date().toISOString(), studentId]
      );
    } catch {
      // The server has saved it. The next sync brings the new status to this phone.
    }
  };

  const runStatusChange = async (path, body, title) => {
    if (student.local_dirty) {
      Alert.alert('Sync first', 'This student has changes that have not synced yet. Sync, then try again.');
      return;
    }
    setStatusBusy(true);
    try {
      const res = await api.post(`/student-status/${studentId}/${path}`, {
        ...body,
        basedOnVersion: student.sync_version,
      });
      await applyLocalStatus(res.student.status, res.student.sync_version);
      setInactiveOpen(false);
      setInactiveReason('');
      await loadStudent();
    } catch (err) {
      Alert.alert(
        title,
        err?.code === 'CONFLICT_VERSION_MISMATCH'
          ? 'This record changed. Sync and try again.'
          : (err?.message || 'Check your connection and try again.')
      );
    } finally {
      setStatusBusy(false);
    }
  };

  const submitInactive = () => {
    if (inactiveReason.trim().length < 3) {
      Alert.alert('Reason needed', 'Write why the student is not attending.');
      return;
    }
    runStatusChange('inactive', { reason: inactiveReason.trim() }, 'Could not mark inactive');
  };

  const clearInactive = () => runStatusChange('clear-inactive', {}, 'Could not clear inactive');

  const undoLeave = () => {
    Alert.alert(
      'Undo leave',
      `Return ${student.full_name} to the roll? The leave stays in the history, marked as undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo leave',
          style: 'destructive',
          onPress: () => runStatusChange('undo-leave', {}, 'Could not undo leave'),
        },
      ]
    );
  };

  const [approvalBusy, setApprovalBusy] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnText, setReturnText] = useState('');

  // Registration approval. Online only: the server checks the scope and the record version,
  // bumps the version so the change reaches every phone, and writes the audit log.
  const approvalAction = async (kind, body = {}) => {
    setApprovalBusy(true);
    try {
      const res = await api.post(`/students/${studentId}/${kind}`, {
        ...body,
        basedOnVersion: student.sync_version,
      });
      try {
        const db = await getDb();
        await db.runAsync(
          'UPDATE students SET approval_status = ?, return_reason = ?, sync_version = ?, updated_at = ? WHERE id = ? AND local_dirty = 0',
          [
            res?.student?.approval_status || 'approved',
            res?.student?.return_reason ?? null,
            res?.student?.sync_version ?? student.sync_version,
            new Date().toISOString(),
            studentId,
          ]
        );
      } catch {
        // The server has saved it. The next sync brings the new state to this phone.
      }
      setReturnOpen(false);
      setReturnText('');
      await loadStudent();
    } catch (err) {
      Alert.alert(
        'Could not save',
        err?.code === 'CONFLICT_VERSION_MISMATCH'
          ? 'This record changed. Sync and try again.'
          : (err?.message || 'Check your connection and try again.')
      );
    } finally {
      setApprovalBusy(false);
    }
  };

  const handlePromote = () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can promote students.');
      return;
    }
    const nextClass = getNextClass(student.class_level);
    if (!nextClass) return;
    if (student.class_level === 'Primary 5' && student.entrance_outcome !== 'admitted') {
      Alert.alert(
        student.entrance_outcome === 'not_admitted' ? 'Not admitted' : 'Result Pending',
        student.entrance_outcome === 'not_admitted'
          ? 'This pupil was not admitted to JSS1 and cannot be promoted.'
          : 'Record the entrance result before promoting this pupil.'
      );
      return;
    }

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
      `Move ${student.full_name} from ${student.class_level} to ${nextClass} (${promoteArm})?`,
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

  // Undo last promote: reverse class and current_session one step.
  // Only available when current_session is after the registered session.
  const handleUndoPromote = () => {
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only a Principal or Director can undo a promotion.');
      return;
    }
    const registered = student.academic_session || null;
    const current = student.current_session || registered;
    if (!sessionIsAfter(current, registered)) {
      Alert.alert('Nothing to undo', 'This student has not been promoted beyond their registered session.');
      return;
    }
    const prevClass = getPreviousClass(student.class_level);
    if (!prevClass) {
      Alert.alert('Nothing to undo', 'This student is already at the earliest class.');
      return;
    }
    Alert.alert(
      'Undo last promote',
      `Move ${student.full_name} back from ${student.class_level} to ${prevClass} and roll the current session back one year?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo', style: 'destructive', onPress: () => performUndoPromotion() },
      ]
    );
  };

  const performUndoPromotion = async () => {
    setPromoting(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const basedOnVersion = student.sync_version;
      const registered = student.academic_session || null;
      const current = student.current_session || registered;
      const prevClass = getPreviousClass(student.class_level);
      let prevSession = current ? previousSession(current) : registered;
      // Never go below registered session.
      if (registered && prevSession && !sessionIsAfter(prevSession, registered) && prevSession !== registered) {
        prevSession = registered;
      }
      const finalSession = prevSession || registered;
      // Clear arm when previous class does not require one.
      const needsArm = armRequiredFor(prevClass);
      const prevArm = needsArm ? student.arm : null;

      await db.runAsync(
        `UPDATE students
         SET class_level = ?, division = ?, arm = ?,
             current_session = ?,
             sync_version = sync_version + 1, updated_at = ?, local_dirty = 1
         WHERE id = ?`,
        [prevClass, divisionOfClass(prevClass), prevArm, finalSession, now, studentId]
      );
      await queueOperation({
        opType: 'undo_promote_student',
        entityId: studentId,
        payload: {
          based_on_version: basedOnVersion,
        },
      });
      await loadStudent();
    } catch (error) {
      Alert.alert('Could not undo', 'Something went wrong undoing this promotion.');
    } finally {
      setPromoting(false);
    }
  };

  const startEditing = () => {
    if (!canEdit) {
      Alert.alert('Not allowed', 'You do not have permission to edit student records.');
      return;
    }
    setEditName(student.full_name || '');
    setEditArm(student.arm || '');
    setEditGuardian(student.guardian_name || '');
    setEditPhone(student.guardian_phone || '');
    setEditAdmissionNo(student.admission_no || '');
    setEditDob(isoToDob(student.date_of_birth));
    setEditGender(student.gender || '');
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
    if (!canEdit) {
      Alert.alert('Not allowed', 'You do not have permission to edit student records.');
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

    const dobIso = dobToIso(editDob);
    if (dobIso === null) {
      Alert.alert('Date of birth', 'Use the format DD/MM/YYYY.');
      return;
    }
    const needsArmNow = armRequiredFor(student.class_level);
    const check = checkRegistration({
      admissionNo: editAdmissionNo,
      fullName: editName,
      division: student.division,
      classLevel: student.class_level,
      arm: needsArmNow ? editArm : student.arm,
      gender: editGender,
      guardianName: editGuardian,
      guardianPhone: editPhone,
      dateOfBirth: dobIso,
    });
    if (!check.ok) {
      Alert.alert('Check the details', formatErrors(check.errors).map((e) => e.message).join('\n'));
      return;
    }

    setSaving(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const basedOnVersion = student.sync_version;
      const v = check.value;

      const nextArm = needsArm ? editArm : student.arm;
      const changes = {
        admission_no: v.admissionNo,
        full_name: v.fullName,
        gender: v.gender || null,
        date_of_birth: v.dateOfBirth || null,
        guardian_name: v.guardianName || null,
        guardian_phone: v.guardianPhone || null,
        arm: nextArm,
      };

      await db.runAsync(
        `UPDATE students
         SET admission_no = ?, full_name = ?, gender = ?, date_of_birth = ?,
             arm = ?, guardian_name = ?, guardian_phone = ?,
             sync_version = sync_version + 1, updated_at = ?, local_dirty = 1
         WHERE id = ?`,
        [
          changes.admission_no,
          changes.full_name,
          changes.gender,
          changes.date_of_birth,
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
  const promoteBlocked = student.class_level === 'Primary 5' && student.entrance_outcome !== 'admitted';
  const outcomeLabel = student.entrance_outcome === 'admitted' ? 'Admitted' : student.entrance_outcome === 'not_admitted' ? 'Not Admitted' : 'Result Pending';
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
        {photoUri && isAdmin && (
          <Pressable style={styles.photoAction} onPress={handleCapturePhoto}>
            <Text style={styles.photoActionText}>Replace passport photo</Text>
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

      {canEdit && !editing && (
        <View style={styles.adminBar}>
          <Pressable style={styles.adminBtn} onPress={startEditing}>
            <Text style={styles.adminBtnText}>Edit</Text>
          </Pressable>
          {isAdmin && (isArchived ? (
            <Pressable style={[styles.adminBtn, styles.adminBtnRestore]} onPress={handleRestore}>
              <Text style={[styles.adminBtnText, styles.adminBtnTextDark]}>Restore</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.adminBtn, styles.adminBtnDanger]} onPress={handleArchive}>
              <Text style={styles.adminBtnText}>Archive</Text>
            </Pressable>
          ))}
        </View>
      )}

      {canEdit && editing && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>EDIT RECORD</Text>
          <View style={styles.infoCard}>
            <Text style={styles.fieldLabel}>Full name *</Text>
            <TextInput style={styles.fieldInput} value={editName} onChangeText={setEditName} placeholder="Student full name" placeholderTextColor="#98A2B3" />

            <Text style={styles.fieldLabel}>Admission number *</Text>
            <TextInput style={styles.fieldInput} value={editAdmissionNo} onChangeText={(t) => setEditAdmissionNo(t.toUpperCase())} placeholder="YMS/2024/03/033" placeholderTextColor="#98A2B3" autoCapitalize="characters" autoCorrect={false} />

            <Text style={styles.fieldLabel}>Date of birth *</Text>
            <TextInput style={styles.fieldInput} value={editDob} onChangeText={(t) => setEditDob(formatDobInput(t))} placeholder="DD/MM/YYYY" placeholderTextColor="#98A2B3" keyboardType="number-pad" maxLength={10} />

            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.chipRowInline}>
              {['M', 'F'].map((g) => (
                <Pressable
                  key={g}
                  style={[styles.chipInline, editGender === g && styles.chipInlineActive]}
                  onPress={() => setEditGender(editGender === g ? '' : g)}
                >
                  <Text style={[styles.chipInlineText, editGender === g && styles.chipInlineTextActive]}>
                    {g === 'M' ? 'Male' : 'Female'}
                  </Text>
                </Pressable>
              ))}
            </View>

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
            <InfoRow label="Registered session" value={student.academic_session || 'Not recorded'} />
            <InfoRow label="Current session" value={student.current_session || student.academic_session || 'Not recorded'} last />
          </View>
        </View>
      )}

      {isAdmin && !editing && LEAVER_STATUSES.includes(student.status) && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>LEAVE</Text>
          <View style={styles.infoCard}>
            <Pressable style={styles.leaveButton} onPress={undoLeave} disabled={statusBusy}>
              <Text style={styles.leaveButtonText}>Undo leave</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isAdmin && !editing && !isArchived && !LEAVER_STATUSES.includes(student.status) && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>PROMOTION</Text>
          <View style={styles.infoCard}>
            {isAtMaxClass(student.class_level) ? (
              <View style={styles.promoteRow}>
                <Text style={styles.maxClassText}>Highest class reached (SS3)</Text>
                {sessionIsAfter(
                  student.current_session || student.academic_session,
                  student.academic_session
                ) && (
                  <Pressable
                    style={styles.undoPromoteButton}
                    onPress={handleUndoPromote}
                    disabled={promoting}
                  >
                    <Text style={styles.undoPromoteButtonText}>
                      {promoting ? 'Working…' : 'Undo last promote'}
                    </Text>
                  </Pressable>
                )}
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
              <>
                {student.class_level === 'Primary 5' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.fieldLabel}>Entrance result: {outcomeLabel}</Text>
                    <View style={styles.editActions}>
                      <Pressable style={styles.continueButton} onPress={() => recordOutcome('admitted')} disabled={recordingOutcome}>
                        {recordingOutcome ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.continueText}>Admitted</Text>}
                      </Pressable>
                      <Pressable style={styles.cancelButton} onPress={() => recordOutcome('not_admitted')} disabled={recordingOutcome}>
                        <Text style={styles.cancelText}>Not Admitted</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                <Pressable style={[styles.promoteButton, promoteBlocked && styles.disabledButton]} onPress={handlePromote} disabled={promoting || promoteBlocked}>
                  <Text style={styles.promoteButtonText}>
                    {promoting ? 'Promoting…' : `Promote to ${nextClass || 'next class'}`}
                  </Text>
                </Pressable>
                {sessionIsAfter(
                  student.current_session || student.academic_session,
                  student.academic_session
                ) && (
                  <Pressable
                    style={styles.undoPromoteButton}
                    onPress={handleUndoPromote}
                    disabled={promoting}
                  >
                    <Text style={styles.undoPromoteButtonText}>
                      {promoting ? 'Working…' : 'Undo last promote'}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      )}

      {student && approvalOf(student) !== 'approved' && !editing && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>REGISTRATION</Text>
          <View style={styles.infoCard}>
            <Text style={styles.maxClassText}>{approvalNotice(student)}</Text>
            {approvalOf(student) === 'returned' && student.return_reason ? (
              <Text style={styles.maxClassText}>Reason: {student.return_reason}</Text>
            ) : null}

            {canApproveRecords(user?.role) && student.approval_status === 'pending' && !returnOpen ? (
              <View style={styles.editActions}>
                <Pressable style={styles.continueButton} onPress={() => approvalAction('approve')} disabled={approvalBusy}>
                  {approvalBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.continueText}>Approve</Text>}
                </Pressable>
                <Pressable style={styles.leaveButton} onPress={() => setReturnOpen(true)} disabled={approvalBusy}>
                  <Text style={styles.leaveButtonText}>Return</Text>
                </Pressable>
              </View>
            ) : null}

            {canApproveRecords(user?.role) && returnOpen ? (
              <View>
                <Text style={styles.fieldLabel}>What should the class teacher fix?</Text>
                <TextInput
                  style={styles.leaveInput}
                  value={returnText}
                  onChangeText={setReturnText}
                  placeholder="Short reason"
                  multiline
                  maxLength={500}
                  editable={!approvalBusy}
                />
                <View style={styles.editActions}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => { setReturnOpen(false); setReturnText(''); }}
                    disabled={approvalBusy}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.continueButton, !returnText.trim() && styles.disabledButton]}
                    onPress={() => approvalAction('return', { reason: returnText.trim() })}
                    disabled={approvalBusy || !returnText.trim()}
                  >
                    <Text style={styles.continueText}>Send back</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {user?.role === 'class_teacher' && student.approval_status === 'returned' && student.registered_by === (user?.id ?? user?.userId) ? (
              <Pressable style={styles.continueButton} onPress={() => approvalAction('resubmit')} disabled={approvalBusy}>
                {approvalBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.continueText}>Resubmit for approval</Text>}
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {isAdmin && !editing && !isArchived && ['registered', 'active', 'promoted'].includes(student.status) && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>ATTENDANCE</Text>
          <View style={styles.infoCard}>
            {!inactiveOpen ? (
              <Pressable style={styles.leaveButton} onPress={() => setInactiveOpen(true)}>
                <Text style={styles.leaveButtonText}>Mark inactive</Text>
              </Pressable>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>Why is the student not attending?</Text>
                <TextInput
                  value={inactiveReason}
                  onChangeText={setInactiveReason}
                  style={styles.leaveInput}
                  placeholder="Reason (required)"
                  maxLength={300}
                />
                <Pressable style={styles.leaveButton} onPress={submitInactive} disabled={statusBusy}>
                  <Text style={styles.leaveButtonText}>Save as inactive</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}

      {isAdmin && !editing && !isArchived && student.status === 'inactive' && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>ATTENDANCE</Text>
          <View style={styles.infoCard}>
            <Text style={styles.maxClassText}>Marked Inactive. The student stays on the roll.</Text>
            <Pressable style={styles.leaveButton} onPress={clearInactive} disabled={statusBusy}>
              <Text style={styles.leaveButtonText}>Clear inactive</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isAdmin && !editing && !isArchived && LEAVABLE_STATUSES.includes(student.status) && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>LEAVING SCHOOL</Text>
          <View style={styles.infoCard}>
            {!leaveOpen ? (
              <Pressable style={styles.leaveButton} onPress={() => setLeaveOpen(true)}>
                <Text style={styles.leaveButtonText}>Record leave</Text>
              </Pressable>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>Why is this student leaving?</Text>
                {leaveOptionsFor(student).map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.leaveOption, leaveType === t && styles.leaveOptionSelected]}
                    onPress={() => setLeaveType(t)}
                    disabled={savingLeave}
                  >
                    <Text style={[styles.leaveOptionText, leaveType === t && styles.leaveOptionTextSelected]}>
                      {LEAVE_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.fieldLabel}>Reason (optional)</Text>
                <TextInput
                  style={styles.leaveInput}
                  value={leaveReason}
                  onChangeText={setLeaveReason}
                  placeholder="Short note for the record"
                  multiline
                  maxLength={500}
                  editable={!savingLeave}
                />
                <View style={styles.editActions}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => { setLeaveOpen(false); setLeaveType(''); setLeaveReason(''); }}
                    disabled={savingLeave}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.continueButton, !leaveType && styles.disabledButton]}
                    onPress={submitLeave}
                    disabled={savingLeave || !leaveType}
                  >
                    {savingLeave ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.continueText}>Record</Text>}
                  </Pressable>
                </View>
              </View>
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
              <ActivityIndicator color="#0E1A2B" size="small" />
            ) : (
              <Text style={styles.exportPdfButtonText}>Export to PDF for printing</Text>
            )}
          </Pressable>
        </View>
      )}

      {!editing && <StudentBiodataSection studentId={studentId} role={user?.role} />}

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
  name: { fontSize: 20, fontWeight: '700', color: '#0E1A2B', textAlign: 'center' },
  admissionNo: { fontSize: 13, color: '#667085', marginTop: 4 },
  chipRowInline: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chipInline: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  chipInlineActive: { backgroundColor: '#1F6FEB', borderColor: '#1F6FEB' },
  chipInlineText: { color: '#344054', fontWeight: '600' },
  chipInlineTextActive: { color: '#FFFFFF' },
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
  photoActionText: { fontSize: 13, color: '#17263B', fontWeight: '600' },
  adminBar: {
    flexDirection: 'row', marginTop: 16, gap: 10,
  },
  adminBtn: {
    flex: 1, backgroundColor: '#17263B', borderRadius: 12,
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
  infoValue: { fontSize: 13, fontWeight: '600', color: '#0E1A2B', maxWidth: '60%', textAlign: 'right' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#667085', marginTop: 12, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0E1A2B',
  },
  fieldInputLast: { marginBottom: 8 },
  classReadOnly: { fontSize: 14, fontWeight: '600', color: '#0E1A2B', marginBottom: 4 },
  editNote: { fontSize: 11, color: '#98A2B3', marginBottom: 4 },
  armOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 8, borderRadius: 10, marginBottom: 4,
  },
  armOptionSelected: { borderWidth: 1, borderColor: '#17263B', backgroundColor: '#EEF3F9' },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#98A2B3',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  radioOuterSelected: { borderColor: '#17263B' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#17263B' },
  armOptionText: { fontSize: 15, color: '#0E1A2B', fontWeight: '600' },
  promoteChoice: { paddingVertical: 8 },
  leaveButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#D0D5DD' },
  leaveButtonText: { fontWeight: '700', color: '#B42318', fontSize: 14 },
  leaveOption: { borderWidth: 1.5, borderColor: '#D0D5DD', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginTop: 8, backgroundColor: '#FFFFFF' },
  leaveOptionSelected: { borderColor: '#0E1A2B', backgroundColor: '#F2F4F7' },
  leaveOptionText: { fontSize: 14, color: '#344054' },
  leaveOptionTextSelected: { fontWeight: '700', color: '#0E1A2B' },
  leaveInput: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 12, minHeight: 64, textAlignVertical: 'top', fontSize: 14, color: '#101828', backgroundColor: '#FFFFFF' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 },
  correctionBox: {
    marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#EAECF0', padding: 16,
  },
  correctionTitle: { fontSize: 14, fontWeight: '600', color: '#0E1A2B', marginBottom: 10 },
  correctionInput: {
    borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 12,
    minHeight: 72, textAlignVertical: 'top', fontSize: 14, color: '#0E1A2B',
  },
  correctionActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F2F4F7' },
  cancelText: { fontWeight: '600', color: '#667085', fontSize: 13 },
  continueButton: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#17263B', minWidth: 100, alignItems: 'center',
  },
  disabledButton: { backgroundColor: '#98A2B3' },
  continueText: { fontWeight: '700', color: '#FFFFFF', fontSize: 13 },
  promoteRow: { paddingVertical: 14 },
  maxClassText: { fontSize: 13, color: '#667085' },
  promoteButton: {
    backgroundColor: '#2FA37A', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginVertical: 8,
  },
  promoteButtonText: { fontWeight: '700', color: '#0E1A2B', fontSize: 14 },
  undoPromoteButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#D0D5DD',
  },
  undoPromoteButtonText: {
    fontWeight: '700',
    color: '#667085',
    fontSize: 14,
  },
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
  syncTitle: { fontWeight: '700', fontSize: 13, color: '#0E1A2B' },
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
    color: '#0E1A2B',
    fontSize: 14,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { useAuth } from '../context/AuthContext';

/**
 * Shows a "this record was merged" notice the FIRST time it opens a
 * student whose local copy was the discarded side of an admission-number
 * reconciliation (Build Spec Section 6, locked decision: never a silent
 * overwrite). The notice is dismissed by tapping OK, which clears the
 * merged_notice_pending flag locally.
 */
export default function StudentDetailScreen({ route, navigation }) {
  const { studentId } = route.params;
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  const isAdmin = user?.role === 'principal' || user?.role === 'director';

  useFocusEffect(
    useCallback(() => {
      loadStudent();
    }, [studentId])
  );

  const loadStudent = async () => {
    const db = await getDb();
    const row = await db.getFirstAsync('SELECT * FROM students WHERE id = ?', [studentId]);
    setStudent(row);

    if (row?.merged_notice_pending) {
      Alert.alert(
        'Record Updated',
        'This student\'s record was reconciled by the Principal after being entered on two devices. The details shown now are the confirmed, correct version.',
        [{ text: 'OK', onPress: () => clearMergedNotice() }]
      );
    }

    const photo = await db.getFirstAsync(
      'SELECT * FROM student_photos WHERE student_id = ? AND is_current = 1',
      [studentId]
    );
    if (photo) setPhotoUri(photo.local_uri || photo.storage_url);
    else setPhotoUri(null);
  };

  const clearMergedNotice = async () => {
    const db = await getDb();
    await db.runAsync('UPDATE students SET merged_notice_pending = 0 WHERE id = ?', [studentId]);
  };

  const handleCapturePhoto = async () => {
    // Exactly ONE photo per student, permanent once uploaded (Build Spec
    // Section 7, locked decision). A Head Teacher cannot replace an
    // existing photo — only navigate to the camera here if there isn't
    // one yet. The server enforces this too (photoService), this is just
    // the first line so a Head Teacher isn't sent through the capture
    // flow only to be rejected after the fact.
    if (photoUri && !isAdmin) {
      Alert.alert(
        'Photo already on file',
        'This student already has a passport photo. If it needs to be corrected, ask your Principal.'
      );
      return;
    }

    if (photoUri && isAdmin) {
      // Principal replacing an existing photo — reason required, matching
      // the mandatory-reason pattern used for permission delegation.
      setShowCorrectionInput(true);
      return;
    }

    navigation.navigate('CameraCapture', { studentId, isCorrection: false });
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

  if (!student) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.photoSection}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <Pressable style={styles.photoPlaceholder} onPress={handleCapturePhoto}>
            <Text style={styles.photoPlaceholderText}>Tap to take passport photo</Text>
          </Pressable>
        )}

        {photoUri && isAdmin && !showCorrectionInput && (
          <Pressable style={styles.correctionLink} onPress={handleCapturePhoto}>
            <Text style={styles.correctionLinkText}>Replace photo (Principal)</Text>
          </Pressable>
        )}

        {showCorrectionInput && (
          <View style={styles.correctionBox}>
            <Text style={styles.correctionLabel}>Why does this photo need to be replaced?</Text>
            <TextInput
              style={styles.correctionInput}
              placeholder="e.g. Wrong student's photo was uploaded"
              value={correctionReason}
              onChangeText={setCorrectionReason}
              multiline
            />
            <View style={styles.correctionButtonRow}>
              <Pressable style={styles.correctionCancel} onPress={() => setShowCorrectionInput(false)}>
                <Text style={styles.correctionCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.correctionConfirm} onPress={handleConfirmCorrection}>
                <Text style={styles.correctionConfirmText}>Continue to Camera</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.name}>{student.full_name}</Text>
      <Text style={styles.admissionNo}>{student.admission_no}</Text>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Class</Text>
        <Text style={styles.detailValue}>{student.class_level}{student.arm ? ` ${student.arm}` : ''}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Status</Text>
        <Text style={styles.detailValue}>{student.status}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Guardian</Text>
        <Text style={styles.detailValue}>{student.guardian_name || '—'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Guardian Phone</Text>
        <Text style={styles.detailValue}>{student.guardian_phone || '—'}</Text>
      </View>

      {student.local_dirty === 1 && (
        <Text style={styles.dirtyNote}>This record has changes waiting to sync.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, alignItems: 'center' },
  photoSection: { marginBottom: 20, alignItems: 'center' },
  photo: { width: 140, height: 140, borderRadius: 8, backgroundColor: '#eee' },
  photoPlaceholder: {
    width: 140, height: 140, borderRadius: 8, backgroundColor: '#f4f2ec',
    justifyContent: 'center', alignItems: 'center', padding: 10,
  },
  photoPlaceholderText: { fontSize: 11, color: '#7a8a99', textAlign: 'center' },
  correctionLink: { marginTop: 8 },
  correctionLinkText: { color: '#a83f3f', fontSize: 11.5, fontWeight: '600' },
  correctionBox: { width: '100%', backgroundColor: '#fbf0e6', borderRadius: 8, padding: 14, marginTop: 12 },
  correctionLabel: { fontSize: 12, fontWeight: '600', color: '#8a5a1f', marginBottom: 8 },
  correctionInput: {
    backgroundColor: '#fff', borderRadius: 6, padding: 10, fontSize: 13, minHeight: 60, textAlignVertical: 'top',
  },
  correctionButtonRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  correctionCancel: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  correctionCancelText: { color: '#8a5a1f', fontSize: 12.5 },
  correctionConfirm: { flex: 1, backgroundColor: '#c9873f', borderRadius: 6, paddingVertical: 10 },
  correctionConfirmText: { textAlign: 'center', color: '#fff', fontWeight: '600', fontSize: 12.5 },
  name: { fontSize: 20, fontWeight: '700', color: '#16324f', textAlign: 'center' },
  admissionNo: { fontSize: 13, color: '#7a8a99', marginBottom: 20 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', width: '100%',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  detailLabel: { fontSize: 13, color: '#7a8a99' },
  detailValue: { fontSize: 13, color: '#16324f', fontWeight: '600' },
  dirtyNote: { fontSize: 11.5, color: '#8a6a1f', marginTop: 16, textAlign: 'center' },
});

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

  const isAdmin =
    user?.role === 'principal' || user?.role === 'director';

  const loadStudent = useCallback(async () => {
    const db = await getDb();

    const row = await db.getFirstAsync(
      'SELECT * FROM students WHERE id = ?',
      [studentId]
    );

    setStudent(row);

    if (row?.merged_notice_pending) {
      Alert.alert(
        'Record Updated',
        'This student’s record was reconciled by the Principal after being entered on two devices. The details shown now are the confirmed, correct version.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await db.runAsync(
                'UPDATE students SET merged_notice_pending = 0 WHERE id = ?',
                [studentId]
              );
            },
          },
        ]
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
      Alert.alert(
        'Reason needed',
        'Please explain why this photo needs to be replaced.'
      );
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

              // Local commit first (Principle 2): update instantly so the
              // screen reflects the promotion even if offline, then queue
              // the same change for the server to apply/verify.
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
              Alert.alert(
                'Could not promote',
                'Something went wrong saving this promotion. Please try again.'
              );
            } finally {
              setPromoting(false);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* PROFILE HEADER */}
      <View style={styles.profileCard}>
        <View style={styles.photoWrapper}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <Pressable
              style={styles.photoPlaceholder}
              onPress={handleCapturePhoto}
            >
              <Text style={styles.photoIcon}>+</Text>
              <Text style={styles.photoPlaceholderText}>
                Add photo
              </Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.name}>{student.full_name}</Text>

        <Text style={styles.admissionNo}>
          {student.admission_no}
        </Text>

        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {status.toUpperCase()}
          </Text>
        </View>

        {photoUri && (
          <Pressable
            style={styles.photoAction}
            onPress={handleCapturePhoto}
          >
            <Text style={styles.photoActionText}>
              {isAdmin ? 'Replace passport photo' : 'Photo on file'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* PHOTO CORRECTION */}
      {showCorrectionInput && (
        <View style={styles.correctionBox}>
          <Text style={styles.sectionEyebrow}>
            PHOTO CORRECTION
          </Text>

          <Text style={styles.correctionTitle}>
            Why should this photo be replaced?
          </Text>

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

            <Pressable
              style={styles.continueButton}
              onPress={handleConfirmCorrection}
            >
              <Text style={styles.continueText}>
                Continue
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ACADEMIC INFORMATION */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>
          ACADEMIC INFORMATION
        </Text>

        <View style={styles.infoCard}>
          <InfoRow
            label="Class"
            value={student.class_level || '—'}
          />

          <InfoRow
            label="Arm"
            value={student.arm || '—'}
          />

          <InfoRow
            label="Division"
            value={student.division || 'Secondary'}
            last
          />
        </View>
      </View>

      {/* PROMOTION */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>
            PROMOTION
          </Text>

          <View style={styles.infoCard}>
            {isAtMaxClass(student.class_level) ? (
              <View style={styles.promoteRow}>
                <Text style={styles.maxClassText}>
                  Highest class reached (SS3)
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.promoteButton}
                onPress={handlePromote}
                disabled={promoting}
              >
                <Text style={styles.promoteButtonText}>
                  {promoting
                    ? 'Promoting…'
                    : `Promote to ${getNextClass(student.class_level) || 'next class'}`}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* GUARDIAN INFORMATION */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>
          GUARDIAN INFORMATION
        </Text>

        <View style={styles.infoCard}>
          <InfoRow
            label="Guardian"
            value={student.guardian_name || '—'}
          />

          <InfoRow
            label="Phone"
            value={student.guardian_phone || '—'}
            last
          />
        </View>
      </View>

      {/* SYNC STATUS */}
      {student.local_dirty === 1 && (
        <View style={styles.syncNotice}>
          <View style={styles.syncIcon}>
            <Text style={styles.syncIconText}>!</Text>
          </View>

          <View style={styles.syncContent}>
            <Text style={styles.syncTitle}>
              Changes waiting to sync
            </Text>

            <Text style={styles.syncText}>
              This record has local changes that will be synchronized when the connection is available.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          YALA • Yalamatrix Schools
        </Text>
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
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },

  content: {
    padding: 18,
    paddingBottom: 35,
  },

  loading: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#667085',
    fontSize: 13,
  },

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 22,
    alignItems: 'center',
  },

  photoWrapper: {
    marginBottom: 14,
  },

  photo: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#F2F4F7',
    borderWidth: 4,
    borderColor: '#F2F4F7',
  },

  photoPlaceholder: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: '#667085',
  },

  photoPlaceholderText: {
    marginTop: 2,
    fontSize: 10,
    color: '#667085',
    fontWeight: '600',
  },

  name: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    color: '#101828',
    textAlign: 'center',
  },

  admissionNo: {
    marginTop: 5,
    fontSize: 12,
    color: '#667085',
    letterSpacing: 0.4,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ECFDF3',
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#12B76A',
    marginRight: 6,
  },

  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#027A48',
  },

  photoAction: {
    marginTop: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },

  photoActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475467',
  },

  section: {
    marginTop: 24,
  },

  sectionEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: '#667085',
    marginBottom: 9,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingHorizontal: 16,
  },

  infoRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },

  infoRowLast: {
    borderBottomWidth: 0,
  },

  infoLabel: {
    fontSize: 12,
    color: '#667085',
  },

  infoValue: {
    maxWidth: '58%',
    fontSize: 13,
    fontWeight: '700',
    color: '#101828',
    textAlign: 'right',
  },

  promoteRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  maxClassText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667085',
  },

  promoteButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },

  promoteButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101828',
  },

  correctionBox: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 16,
  },

  correctionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 10,
  },

  correctionInput: {
    minHeight: 80,
    backgroundColor: '#FCFCFD',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#101828',
    textAlignVertical: 'top',
  },

  correctionActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },

  cancelButton: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F2F4F7',
  },

  cancelText: {
    color: '#475467',
    fontSize: 12,
    fontWeight: '700',
  },

  continueButton: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#101828',
  },

  continueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  syncNotice: {
    marginTop: 22,
    flexDirection: 'row',
    backgroundColor: '#FFFAEB',
    borderWidth: 1,
    borderColor: '#FEDF89',
    borderRadius: 15,
    padding: 13,
  },

  syncIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#FEF0C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  syncIconText: {
    color: '#B54708',
    fontWeight: '900',
    fontSize: 12,
  },

  syncContent: {
    flex: 1,
  },

  syncTitle: {
    color: '#7A2E0E',
    fontSize: 11.5,
    fontWeight: '800',
  },

  syncText: {
    marginTop: 3,
    color: '#B54708',
    fontSize: 10.5,
    lineHeight: 16,
  },

  footer: {
    alignItems: 'center',
    marginTop: 28,
  },

  footerText: {
    fontSize: 9,
    color: '#98A2B3',
    letterSpacing: 0.4,
  },
});

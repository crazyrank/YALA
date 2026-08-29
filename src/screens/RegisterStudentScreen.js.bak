import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { queueOperation } from '../services/syncEngine';

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

  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState([]);

  const handleLookupChange = async (text) => {
    setLookupQuery(text);
    if (!text.trim()) {
      setLookupResults([]);
      return;
    }
    try {
      const db = await getDb();
      const term = `%${text}%`;
      const rows = await db.getAllAsync(
        `SELECT id, admission_no, full_name, class_level, arm
         FROM students
         WHERE full_name LIKE ? OR admission_no LIKE ?
         ORDER BY full_name ASC
         LIMIT 5`,
        [term, term]
      );
      setLookupResults(rows);
    } catch (err) {
      setLookupResults([]);
    }
  };

  const handleSave = async () => {
    if (
      !admissionNo.trim() ||
      !fullName.trim() ||
      !classLevel.trim()
    ) {
      Alert.alert(
        'Missing details',
        'Admission number, student name, and class are required.'
      );
      return;
    }

    setSaving(true);

    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      const db = await getDb();

      await db.runAsync(
        `INSERT INTO students
          (
            id,
            admission_no,
            full_name,
            division,
            class_level,
            arm,
            guardian_name,
            guardian_phone,
            status,
            sync_version,
            created_at,
            updated_at,
            local_dirty
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'registered', 1, ?, ?, 1)`,
        [
          id,
          admissionNo.trim(),
          fullName.trim(),
          division,
          classLevel.trim(),
          arm.trim() || null,
          guardianName.trim() || null,
          guardianPhone.trim() || null,
          now,
          now,
        ]
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
        'Student saved',
        'The record is safely stored on this device and will sync automatically when an internet connection is available.',
        [
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      Alert.alert(
        'Could not save',
        err.message || 'Something went wrong while saving this student.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F6F7F9"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* FIND EXISTING STUDENT */}
        <View style={styles.lookupCard}>
          <Text style={styles.lookupLabel}>Find existing student</Text>
          <View style={styles.lookupBox}>
            <Ionicons name="search" size={17} color="#667085" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.lookupInput}
              placeholder="Search by name or admission number"
              placeholderTextColor="#98A2B3"
              value={lookupQuery}
              onChangeText={handleLookupChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {lookupQuery.length > 0 && (
              <Pressable onPress={() => handleLookupChange('')} hitSlop={10}>
                <Ionicons name="close-circle" size={17} color="#98A2B3" />
              </Pressable>
            )}
          </View>

          {lookupResults.length > 0 && (
            <View style={styles.lookupResults}>
              {lookupResults.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.lookupResultRow}
                  onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
                >
                  <View>
                    <Text style={styles.lookupResultName}>{item.full_name}</Text>
                    <Text style={styles.lookupResultSub}>
                      {item.admission_no || 'No admission number'}
                      {item.class_level ? ` • ${item.class_level}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>STUDENT RECORDS</Text>

          <Text style={styles.title}>
            Register student
          </Text>

          <Text style={styles.subtitle}>
            Create a student record directly on this device.
            It will sync with the school system automatically.
          </Text>
        </View>

        {/* OFFLINE NOTICE */}
        <View style={styles.offlineNotice}>
          <View style={styles.offlineDot} />

          <View style={styles.offlineTextArea}>
            <Text style={styles.offlineTitle}>
              Offline-first registration
            </Text>

            <Text style={styles.offlineText}>
              You can save this record without internet access.
              Synchronisation happens automatically later.
            </Text>
          </View>
        </View>

        {/* FORM CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Student information
          </Text>

          <Field
            label="ADMISSION NUMBER"
            required
            value={admissionNo}
            onChangeText={setAdmissionNo}
            placeholder="e.g. YAL/2026/0142"
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Field
            label="FULL NAME"
            required
            value={fullName}
            onChangeText={setFullName}
            placeholder="Student's full name"
            autoCapitalize="words"
            autoCorrect={false}
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              DIVISION <Text style={styles.required}>*</Text>
            </Text>

            <View style={styles.segmentRow}>
              <Pressable
                style={[
                  styles.segment,
                  division === 'primary' && styles.segmentActive,
                ]}
                onPress={() => setDivision('primary')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    division === 'primary' &&
                      styles.segmentTextActive,
                  ]}
                >
                  Primary
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.segment,
                  division === 'secondary' && styles.segmentActive,
                ]}
                onPress={() => setDivision('secondary')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    division === 'secondary' &&
                      styles.segmentTextActive,
                  ]}
                >
                  Secondary
                </Text>
              </Pressable>
            </View>
          </View>

          <Field
            label="CLASS LEVEL"
            required
            value={classLevel}
            onChangeText={setClassLevel}
            placeholder={
              division === 'primary'
                ? 'e.g. Primary 4'
                : 'e.g. SS2'
            }
            autoCapitalize="characters"
          />

          <Field
            label="ARM"
            hint="Secondary students only"
            value={arm}
            onChangeText={setArm}
            placeholder="e.g. Science"
            autoCapitalize="words"
          />

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionTitle}>
            Guardian information
          </Text>

          <Text style={styles.sectionHint}>
            These details are optional and can be completed later.
          </Text>

          <Field
            label="GUARDIAN NAME"
            value={guardianName}
            onChangeText={setGuardianName}
            placeholder="Parent or guardian name"
            autoCapitalize="words"
          />

          <Field
            label="GUARDIAN PHONE"
            value={guardianPhone}
            onChangeText={setGuardianPhone}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />

          {/* SAVE */}
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
              saving && styles.disabledButton,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.saveText}>
                  Saving record...
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.saveText}>
                  Save student
                </Text>

                <Text style={styles.saveArrow}>
                  →
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>
            YALA
          </Text>

          <Text style={styles.footerText}>
            Yalamatrix School Information System
          </Text>

          <Text style={styles.footerSchool}>
            Yalamatrix Schools • Okitipupa
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  required,
  hint,
  ...props
}) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}{' '}
          {required && (
            <Text style={styles.required}>*</Text>
          )}
        </Text>

        {hint && (
          <Text style={styles.fieldHint}>
            {hint}
          </Text>
        )}
      </View>

      <TextInput
        style={styles.input}
        placeholderTextColor="#98A2B3"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 20,
  },

  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.7,
    color: '#667085',
    marginBottom: 8,
  },

  lookupCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 13,
    padding: 14,
    marginBottom: 20,
  },
  lookupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667085',
    marginBottom: 8,
  },
  lookupBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  lookupInput: {
    flex: 1,
    fontSize: 13,
    color: '#101828',
    paddingVertical: 0,
  },
  lookupResults: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
  },
  lookupResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  lookupResultName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#101828',
  },
  lookupResultSub: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
  },

  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.8,
    color: '#101828',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#667085',
  },

  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF9',
    borderWidth: 1,
    borderColor: '#B7E4D9',
    borderRadius: 13,
    padding: 13,
    marginBottom: 16,
  },

  offlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#1F8A7A',
    marginTop: 4,
    marginRight: 10,
  },

  offlineTextArea: {
    flex: 1,
  },

  offlineTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#176B60',
  },

  offlineText: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#4B766F',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EAECF0',
    shadowColor: '#101828',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#101828',
    marginBottom: 16,
  },

  sectionHint: {
    fontSize: 10.5,
    color: '#98A2B3',
    marginTop: -9,
    marginBottom: 17,
  },

  fieldGroup: {
    marginBottom: 16,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },

  label: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#475467',
  },

  required: {
    color: '#B42318',
  },

  fieldHint: {
    marginLeft: 'auto',
    fontSize: 9,
    color: '#98A2B3',
  },

  input: {
    height: 51,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#101828',
    backgroundColor: '#FCFCFD',
  },

  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },

  segment: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FCFCFD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  segmentActive: {
    backgroundColor: '#101828',
    borderColor: '#101828',
  },

  segmentText: {
    color: '#475467',
    fontSize: 12,
    fontWeight: '700',
  },

  segmentTextActive: {
    color: '#FFFFFF',
  },

  sectionDivider: {
    height: 1,
    backgroundColor: '#EAECF0',
    marginVertical: 7,
    marginBottom: 20,
  },

  saveButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#101828',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  saveButtonPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  disabledButton: {
    opacity: 0.65,
  },

  saveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },

  saveArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '300',
    marginLeft: 12,
  },

  footer: {
    alignItems: 'center',
    paddingTop: 24,
  },

  footerTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#101828',
  },

  footerText: {
    marginTop: 4,
    fontSize: 9,
    color: '#98A2B3',
  },

  footerSchool: {
    marginTop: 3,
    fontSize: 8,
    color: '#B0B7C3',
  },
});

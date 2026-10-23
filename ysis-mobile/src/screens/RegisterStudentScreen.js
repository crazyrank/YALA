import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { queueOperation } from '../services/syncEngine';
import { checkRegistration, formatErrors } from '../services/registrationGuard';
import ClassLevelPicker from '../components/ClassLevelPicker';
import { CLASS_ORDER } from '../utils/classProgression';
import { divisionOfClass, ARMS, formatAdmissionInput } from '../utils/studentRules';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { academicSessionFor, availableSessions } from '../utils/academicSession';

export default function RegisterStudentScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = colors.mode === 'dark';
  const prefillName = route.params?.prefillName || '';

  const [admissionNo, setAdmissionNo] = useState('');
  const [fullName, setFullName] = useState(prefillName);
  const [division, setDivision] = useState('secondary');
  const [classLevel, setClassLevel] = useState('');
  const [arm, setArm] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  // Newest session first. Defaults to the current session.
  const sessionOptions = useMemo(() => availableSessions(new Date()).reverse(), []);
  const [academicSession, setAcademicSession] = useState(() => academicSessionFor(new Date()));
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

  // Switching division clears a class that belongs to the other division,
  // and clears the arm when the student is primary.
  const chooseDivision = (next) => {
    setDivision(next);
    if (classLevel && divisionOfClass(classLevel) !== next) setClassLevel('');
    if (next === 'primary') setArm('');
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

    const check = checkRegistration({
      admissionNo,
      fullName,
      division,
      classLevel,
      arm,
      guardianName,
      guardianPhone,
    });
    if (!check.ok) {
      const lines = formatErrors(check.errors).map((e) => e.message);
      Alert.alert('Check the details', lines.join('\n'));
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
            academic_session,
            current_session,
            status,
            sync_version,
            created_at,
            updated_at,
            local_dirty
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered', 1, ?, ?, 1)`,
        [
          id,
          admissionNo.trim(),
          fullName.trim(),
          division,
          classLevel.trim(),
          arm.trim() || null,
          guardianName.trim() || null,
          guardianPhone.trim() || null,
          academicSession,
          academicSession,
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
          academicSession,
          currentSession: academicSession,
        },
      });

      Alert.alert(
        'Student saved',
        'The record is saved on this device.',
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={[styles.fixedHeader, { paddingTop: Math.max(insets.top, 12) + 12 }]}>
        <Text style={styles.title}>Register student</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 4, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* FIND EXISTING STUDENT */}
        <View style={styles.lookupBox}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.lookupInput}
            placeholder="Find an existing student"
            placeholderTextColor={colors.textSecondary}
            value={lookupQuery}
            onChangeText={handleLookupChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {lookupQuery.length > 0 && (
            <Pressable onPress={() => handleLookupChange('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {lookupResults.length > 0 && (
          <View style={styles.resultsCard}>
            {lookupResults.map((item, index) => (
              <Pressable
                key={item.id}
                style={[styles.resultRow, index > 0 && styles.resultDivider]}
                onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
              >
                <View style={styles.resultText}>
                  <Text style={styles.resultName}>{item.full_name}</Text>
                  <Text style={styles.resultSub}>
                    {item.admission_no || 'No admission number'}
                    {item.class_level ? `  ${item.class_level}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}

        {/* STUDENT DETAILS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Student</Text>

          <Field
            label="ADMISSION NUMBER"
            required
            value={admissionNo}
            onChangeText={(t) => setAdmissionNo(formatAdmissionInput(t))}
            placeholder="YMS/00/00/000"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={15}
            styles={styles}
            colors={colors}
          />

          <Field
            label="FULL NAME"
            required
            value={fullName}
            onChangeText={setFullName}
            placeholder="Student's full name"
            styles={styles}
            colors={colors}
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              DIVISION <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.segment}>
              {['primary', 'secondary'].map((d) => {
                const active = division === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => chooseDivision(d)}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {d === 'primary' ? 'Primary' : 'Secondary'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              CLASS LEVEL <Text style={styles.required}>*</Text>
            </Text>
            <ClassLevelPicker
              value={classLevel}
              onChange={setClassLevel}
              allowed={CLASS_ORDER.filter((c) => divisionOfClass(c) === division)}
            />
          </View>

          {division === 'secondary' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>ARM</Text>
              <View style={styles.chipRow}>
                {ARMS.map((a) => {
                  const active = arm === a;
                  return (
                    <Pressable
                      key={a}
                      onPress={() => setArm(active ? '' : a)}
                      style={[styles.chip, active && styles.chipActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{a}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              ACADEMIC SESSION <Text style={styles.required}>*</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sessionRow}
            >
              {sessionOptions.map((s) => {
                const active = academicSession === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setAcademicSession(s)}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.hint}>
              The session this student was admitted. For a student who joined earlier, choose that earlier session.
            </Text>
          </View>
        </View>

        {/* GUARDIAN */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Guardian</Text>

          <Field
            label="GUARDIAN NAME"
            value={guardianName}
            onChangeText={setGuardianName}
            placeholder="Parent or guardian name"
            styles={styles}
            colors={colors}
          />

          <Field
            label="GUARDIAN PHONE"
            value={guardianPhone}
            onChangeText={setGuardianPhone}
            placeholder="Phone number"
            keyboardType="phone-pad"
            styles={styles}
            colors={colors}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            (pressed || saving) && styles.saveButtonPressed,
          ]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Text style={styles.saveText}>Save student</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, required, styles, colors, ...props }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20 },
    fixedHeader: {
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    title: {
      fontFamily: fontFamily.display,
      fontSize: 28,
      letterSpacing: -0.6,
      color: colors.textPrimary,
    },

    lookupBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 52,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    lookupInput: { flex: 1, fontSize: 15, color: colors.textPrimary },
    resultsCard: {
      marginTop: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },
    resultDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    resultText: { flex: 1 },
    resultName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    resultSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

    card: {
      marginTop: 20,
      padding: 20,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 16,
    },
    fieldGroup: { marginBottom: 18 },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    required: { color: colors.error },
    input: {
      height: 52,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      fontSize: 16,
      color: colors.textPrimary,
    },

    segment: {
      flexDirection: 'row',
      padding: 4,
      gap: 4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
    },
    segmentItem: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentItemActive: { backgroundColor: colors.ink },
    segmentText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    segmentTextActive: { color: colors.textInverse },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sessionRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
    hint: { fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 8 },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    chipTextActive: { color: colors.textInverse },

    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      height: 56,
      marginTop: 24,
      borderRadius: 16,
      backgroundColor: colors.ink,
    },
    saveButtonPressed: { opacity: 0.85 },
    saveText: { fontSize: 16, fontWeight: '700', color: colors.textInverse },
  });
}

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius } from '../theme/spacing';
import { getStaffReports, saveStaffReportOffline } from '../services/staffReportsLocal';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const RECOGNITION_OPTIONS = [
  { key: 'none', label: 'None' },
  { key: 'teacher_of_the_month', label: 'Teacher of the Month' },
  { key: 'teacher_of_the_year', label: 'Teacher of the Year' },
];
const ROLE_LABELS = { head_teacher: 'Head Teacher', class_teacher: 'Class Teacher' };

function recognitionLabel(key) {
  if (!key || key === 'none') return '';
  const found = RECOGNITION_OPTIONS.find((o) => o.key === key);
  return found ? found.label : '';
}

function formatMonth(ym) {
  if (!ym) return '';
  const [y, m] = String(ym).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StaffReportsScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [score, setScore] = useState(null);
  const [comment, setComment] = useState('');
  const [recognition, setRecognition] = useState('none');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getStaffReports();
      setData(res);
    } catch (e) {
      setError(e.message || 'Could not load staff reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openSubject = (subject) => {
    const r = subject.report;
    setActive(subject);
    setScore(r ? r.score : null);
    setComment(r ? r.comment : '');
    setRecognition(r ? r.recognition : 'none');
  };

  const closeSheet = () => {
    setActive(null);
    setSaving(false);
  };

  const canEdit = !!active && (active.report ? active.report.canEdit : !!data && !!data.canWrite);

  const save = async () => {
    if (!score) {
      Alert.alert('Score needed', 'Choose a score from 1 to 10.');
      return;
    }
    if (!comment.trim()) {
      Alert.alert('Comment needed', 'Write a short comment about this person.');
      return;
    }
    setSaving(true);
    try {
      const payload = { score, comment: comment.trim(), recognition };
      await saveStaffReportOffline(data, active, payload);
      closeSheet();
      await load();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e.message || 'Please try again.');
    }
  };

  const subjects = data ? data.subjects : [];

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        {!!data && (
          <Text style={[styles.month, { color: colors.textPrimary }]}>{formatMonth(data.month)}</Text>
        )}
        {!!data && (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            {data.canWrite
              ? 'Write one report per person this month. Reports save on this phone and sync when connected. You can correct your own report within 24 hours of writing it.'
              : 'Read only. You can see the reports for your scope.'}
          </Text>
        )}

        {loading && <ActivityIndicator style={{ marginTop: 24 }} color={colors.gold} />}

        {!!error && !loading && (
          <Text style={[styles.note, { color: colors.error }]}>{error}</Text>
        )}

        {!loading && !error && subjects.length === 0 && (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            No staff members are in your scope yet.
          </Text>
        )}

        {subjects.map((s) => {
          const r = s.report;
          const rec = r ? recognitionLabel(r.recognition) : '';
          const classText = s.classLevel ? `, ${s.classLevel}${s.arm ? ` ${s.arm}` : ''}` : '';
          return (
            <Pressable
              key={s.id}
              onPress={() => openSubject(s)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {s.fullName}
                </Text>
                <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                  {(ROLE_LABELS[s.role] || s.role) + classText}
                </Text>
                {!!rec && <Text style={[styles.rec, { color: colors.goldDark }]}>{rec}</Text>}
              </View>
              <View
                style={[
                  styles.scoreBox,
                  {
                    backgroundColor: r ? colors.ink : colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.scoreText, { color: r ? colors.textInverse : colors.textMuted }]}>
                  {r ? `${r.score}/10` : 'New'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={!!active} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {!!active && (
              <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
                <Text style={[styles.sheetName, { color: colors.textPrimary }]}>{active.fullName}</Text>
                <Text style={[styles.sub, { color: colors.textMuted }]}>
                  {ROLE_LABELS[active.role] || active.role}
                </Text>

                {!canEdit && !active.report && (
                  <Text style={[styles.note, { color: colors.textMuted }]}>
                    No report has been written for this month.
                  </Text>
                )}

                {!canEdit && !!active.report && (
                  <>
                    <Text style={[styles.label, { color: colors.textMuted }]}>SCORE</Text>
                    <Text style={[styles.readValue, { color: colors.textPrimary }]}>
                      {active.report.score} / 10
                    </Text>
                    {!!recognitionLabel(active.report.recognition) && (
                      <Text style={[styles.rec, { color: colors.goldDark }]}>
                        {recognitionLabel(active.report.recognition)}
                      </Text>
                    )}
                    <Text style={[styles.label, { color: colors.textMuted }]}>COMMENT</Text>
                    <Text style={[styles.readValue, { color: colors.textPrimary }]}>
                      {active.report.comment}
                    </Text>
                    {active.report.correctionCount > 0 && !!active.report.originalComment && (
                      <>
                        <Text style={[styles.label, { color: colors.textMuted }]}>FIRST WRITTEN</Text>
                        <Text style={[styles.readValue, { color: colors.textMuted }]}>
                          {active.report.originalComment}
                        </Text>
                      </>
                    )}
                    <Text style={[styles.note, { color: colors.textMuted }]}>
                      Written by {active.report.writtenByName || 'staff'} on{' '}
                      {formatDate(active.report.writtenAt)}
                      {active.report.correctionCount > 0
                        ? `, corrected ${active.report.correctionCount} time(s)`
                        : ''}
                      .
                    </Text>
                  </>
                )}

                {canEdit && (
                  <>
                    <Text style={[styles.label, { color: colors.textMuted }]}>SCORE</Text>
                    <View style={styles.scoreRow}>
                      {SCORES.map((n) => (
                        <Pressable
                          key={n}
                          onPress={() => setScore(n)}
                          style={[
                            styles.scoreChip,
                            {
                              borderColor: colors.border,
                              backgroundColor: score === n ? colors.ink : colors.background,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.scoreChipText,
                              { color: score === n ? colors.textInverse : colors.textPrimary },
                            ]}
                          >
                            {n}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={[styles.label, { color: colors.textMuted }]}>COMMENT</Text>
                    <TextInput
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      maxLength={1000}
                      placeholder="What stood out this month"
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.input,
                        {
                          color: colors.textPrimary,
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                        },
                      ]}
                    />

                    <Text style={[styles.label, { color: colors.textMuted }]}>RECOGNITION</Text>
                    <View style={styles.recRow}>
                      {RECOGNITION_OPTIONS.map((o) => {
                        const on = recognition === o.key;
                        return (
                          <Pressable
                            key={o.key}
                            onPress={() => setRecognition(o.key)}
                            style={[
                              styles.recChip,
                              {
                                borderColor: colors.border,
                                backgroundColor: on ? colors.gold : colors.background,
                              },
                            ]}
                          >
                            <Text style={[styles.recChipText, { color: on ? '#0E1A2B' : colors.textPrimary }]}>
                              {o.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Pressable
                      disabled={saving}
                      onPress={save}
                      style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: saving ? 0.6 : 1 }]}
                    >
                      {saving ? (
                        <ActivityIndicator color="#0E1A2B" />
                      ) : (
                        <Text style={styles.saveText}>
                          {active.report ? 'Save correction' : 'Save report'}
                        </Text>
                      )}
                    </Pressable>
                  </>
                )}

                <Pressable onPress={closeSheet} style={styles.closeBtn}>
                  <Text style={[styles.closeText, { color: colors.textMuted }]}>Close</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  month: { fontFamily: fontFamily.display, fontSize: 22, marginBottom: 6 },
  note: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 6, marginBottom: 10, lineHeight: 19 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  name: { fontFamily: fontFamily.heading, fontSize: 15 },
  sub: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 2 },
  rec: { fontFamily: fontFamily.bodyBold, fontSize: 12, marginTop: 4 },
  scoreBox: {
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  scoreText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,25,48,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  sheetName: { fontFamily: fontFamily.display, fontSize: 20 },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  readValue: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22 },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scoreChip: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreChipText: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontFamily: fontFamily.body,
    fontSize: 15,
  },
  recRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  recChipText: { fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  saveBtn: {
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveText: { fontFamily: fontFamily.bodyBold, fontSize: 15, color: '#0E1A2B' },
  closeBtn: { alignItems: 'center', paddingVertical: 14 },
  closeText: { fontFamily: fontFamily.bodySemibold, fontSize: 14 },
});

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { HEADER } from '../services/studentImportCore';
import {
  previewCsvFile,
  stageImport,
  listStagedImports,
  uploadStagedImport,
  uploadAllPending,
  discardStagedImport,
  purgeOldCompletedImports,
} from '../services/stagedImports';

const IMPORT_GUIDE = [
  { column: 'admission_no', rule: 'the admission number, for example YMS/2024/03/033.' },
  { column: 'full_name', rule: "the student's full name. Letters only." },
  { column: 'division', rule: 'primary or secondary.' },
  { column: 'class_level', rule: 'for example KG1, Primary 4, JSS1 or SS2.' },
  { column: 'arm', rule: 'only for SS2 and SS3 (Science, Arts or Commercial). Leave empty for every other class.' },
  { column: 'guardian_name', rule: 'the guardian\'s name. May be left empty.' },
  { column: 'guardian_phone', rule: 'the guardian\'s phone number, digits only. May be left empty.' },
  { column: 'gender', rule: 'M or F. Required.' },
  { column: 'date_of_birth', rule: 'written as DD/MM/YYYY, for example 25/03/2014. Required.' },
  { column: 'session', rule: 'the session the student was admitted, for example 2024/2025. Required.' },
];

const IMPORT_CONSEQUENCES = [
  'If a column name is missing, misspelled or extra, the whole file is declined and nothing is saved.',
  'If a student row breaks a rule, only that row is skipped. The other rows are still imported.',
  'Every skipped row is listed with its row number, the column and the reason, so it can be corrected and uploaded again.',
  'If an admission number appears twice in the file, both rows are skipped.',
  'A student who already exists is never changed by an import.',
  'In Excel, format the date_of_birth column as Text before typing dates, so Excel keeps the DD/MM/YYYY layout.',
];

const STATUS_LABEL = {
  staged: 'Waiting to upload',
  uploading: 'Uploading',
  completed: 'Saved on server',
  failed: 'Not saved',
};

const SHOW_SKIPPED = 50;

function messageFor(outcome) {
  if (outcome.state === 'completed') {
    const r = outcome.result || {};
    return `Saved on the server: ${r.imported ?? 0} students imported, ${r.skipped ?? 0} skipped.`;
  }
  if (outcome.state === 'retry') {
    return 'Could not reach the server. The import is kept and will be sent the next time you open this screen.';
  }
  if (outcome.state === 'failed') {
    return `The server did not save this import (${outcome.code}). Nothing was kept on this phone. Choose the file again.`;
  }
  return 'That import is no longer on this phone.';
}

export default function ImportStudentsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'principal' || user?.role === 'director';

  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [staged, setStaged] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [selected, setSelected] = useState(null);

  const refresh = useCallback(async () => {
    try {
      await purgeOldCompletedImports();
    } catch {
      /* clearing old entries is optional, so the list still loads */
    }
    setStaged(await listStagedImports());
  }, []);

  // Sends anything still waiting, then shows the current list.
  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) return undefined;
      let cancelled = false;
      (async () => {
        setBusy(true);
        try {
          await uploadAllPending();
        } catch {
          /* shown as waiting in the list */
        } finally {
          if (!cancelled) {
            await refresh();
            setBusy(false);
          }
        }
      })();
      return () => { cancelled = true; };
    }, [isAdmin, refresh])
  );

  const pickFile = async () => {
    setNotice(null);
    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch {
      Alert.alert('Could not open files', 'Please try again.');
      return;
    }
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setBusy(true);
    try {
      if (!/\.csv$/i.test(asset.name || '')) {
        Alert.alert('Not a CSV file', 'Choose a file whose name ends in .csv.');
        return;
      }
      const p = await previewCsvFile({ uri: asset.uri, sizeBytes: asset.size });
      if (!p.ok) {
        Alert.alert('File not accepted', p.message);
        setPreview(null);
        return;
      }
      setPreview(p);
      setFileName(asset.name);
    } finally {
      // Remove the phone's temporary copy of the file. Only the checked rows are kept, and only once staged.
      if (asset?.uri) {
        FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
      }
      setBusy(false);
    }
  };

  const stagePreview = () => {
    if (!preview || preview.readyCount === 0) {
      Alert.alert('Nothing to import', 'No rows passed the checks.');
      return;
    }
    Alert.alert(
      'Stage this import?',
      `${preview.readyCount} students will be sent to the server when this phone is online. ${preview.skippedCount} rows will be skipped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stage',
          onPress: async () => {
            setBusy(true);
            try {
              await stageImport({ fileName, preview });
              setPreview(null);
              setNotice('Saved on this phone. Sending now if online.');
              await uploadAllPending();
              await refresh();
            } catch {
              Alert.alert('Could not save', 'Something went wrong saving this import on the phone.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const uploadNow = async (importKey) => {
    setBusy(true);
    try {
      const outcome = await uploadStagedImport(importKey);
      setNotice(messageFor(outcome));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const discard = (row) => {
    const done = row.status === 'completed';
    Alert.alert(
      done ? 'Clear from list?' : 'Discard import?',
      done
        ? `This only removes "${row.file_name}" from this list. Students already imported stay saved.`
        : `Remove "${row.file_name}" from this phone? Its students will not be saved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: done ? 'Clear' : 'Discard',
          style: done ? 'default' : 'destructive',
          onPress: async () => {
            const r = await discardStagedImport(row.import_key);
            if (!r.ok) {
              Alert.alert('Cannot remove', r.message);
              return;
            }
            setSelected(null);
            await refresh();
          },
        },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Only a Principal or Director can import students.
        </Text>
      </View>
    );
  }

  const skippedShown = preview ? preview.localSkipped.slice(0, SHOW_SKIPPED) : [];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        Choose a CSV file. Rows are checked here, then checked again by the server before anything is saved.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>FILE FORMAT</Text>
        <Text style={[styles.body, { color: colors.textPrimary }]}>
          Use a CSV file (UTF-8) with up to 2,000 students and a size under 1 MB. The first row must contain these column names, spelled exactly as shown:
        </Text>
        <Text style={[styles.mono, { color: colors.textPrimary }]}>{HEADER.join(', ')}</Text>

        <Text style={[styles.label, { color: colors.textMuted, marginTop: 14 }]}>WHAT TO ENTER IN EACH COLUMN</Text>
        {IMPORT_GUIDE.map((item) => (
          <Text key={item.column} style={[styles.small, { color: colors.textPrimary }]}>
            {item.column}: {item.rule}
          </Text>
        ))}

        <Text style={[styles.label, { color: colors.textMuted, marginTop: 14 }]}>IF THE FILE DOES NOT FOLLOW THE FORMAT</Text>
        {IMPORT_CONSEQUENCES.map((line, i) => (
          <Text key={i} style={[styles.small, { color: colors.textPrimary }]}>{'\u2022'} {line}</Text>
        ))}
      </View>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: colors.inkSoft }, busy && styles.disabled]}
        onPress={pickFile}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.primaryText}>Choose CSV file</Text>
      </Pressable>

      {busy && <ActivityIndicator style={styles.spinner} color={colors.gold} />}
      {notice && <Text style={[styles.notice, { color: colors.textPrimary }]}>{notice}</Text>}

      {preview && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Preview: {fileName}</Text>
          <Text style={[styles.body, { color: colors.textPrimary }]}>Ready to import: {preview.readyCount}</Text>
          <Text style={[styles.body, { color: colors.textPrimary }]}>Will be skipped: {preview.skippedCount}</Text>
          {skippedShown.map((r, i) => (
            <Text key={`${r.row}-${r.column}-${i}`} style={[styles.small, { color: colors.textMuted }]}>
              Row {r.row}, {r.column}: {r.reason}
            </Text>
          ))}
          {preview.localSkipped.length > SHOW_SKIPPED && (
            <Text style={[styles.small, { color: colors.textMuted }]}>
              And {preview.localSkipped.length - SHOW_SKIPPED} more skipped rows.
            </Text>
          )}
          <View style={styles.row}>
            <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setPreview(null)}>
              <Text style={[styles.secondaryText, { color: colors.textPrimary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, styles.flexButton, { backgroundColor: colors.inkSoft }, busy && styles.disabled]}
              onPress={stagePreview}
              disabled={busy}
            >
              <Text style={styles.primaryText}>Stage for upload</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>Imports on this phone</Text>
      {staged.length === 0 && (
        <Text style={[styles.body, { color: colors.textMuted }]}>Nothing waiting.</Text>
      )}
      {staged.map((row) => {
        if (row.status === 'completed') {
          const result = row.server_result_json ? JSON.parse(row.server_result_json) : {};
          return (
            <Pressable
              key={row.import_key}
              onPress={() => setSelected(row)}
              accessibilityRole="button"
              accessibilityLabel={`Open details for ${row.file_name}`}
              style={({ pressed }) => [
                styles.card,
                styles.tapCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.flexButton}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{row.file_name}</Text>
                <View style={[styles.badge, { backgroundColor: colors.successBg }]}>
                  <Text style={[styles.badgeText, { color: colors.success }]}>Saved</Text>
                </View>
                <Text style={[styles.small, { color: colors.textMuted }]}>
                  {new Date(row.created_at).toLocaleString()}
                </Text>
                <Text style={[styles.small, { color: colors.textPrimary }]}>
                  {result.imported ?? 0} imported, {result.skipped ?? 0} skipped
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>{'\u203A'}</Text>
            </Pressable>
          );
        }
        return (
          <View key={row.import_key} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{row.file_name}</Text>
            <Text style={[styles.small, { color: colors.textMuted }]}>
              {new Date(row.created_at).toLocaleString()} · {STATUS_LABEL[row.status] || row.status}
            </Text>
            <Text style={[styles.body, { color: colors.textPrimary }]}>Ready: {row.ready_count}</Text>
            {row.error_code && (
              <Text style={[styles.small, { color: colors.error }]}>Last result: {row.error_code}</Text>
            )}
            <View style={styles.row}>
              {row.status === 'staged' && (
                <Pressable
                  style={[styles.primaryButton, styles.flexButton, { backgroundColor: colors.inkSoft }, busy && styles.disabled]}
                  onPress={() => uploadNow(row.import_key)}
                  disabled={busy}
                >
                  <Text style={styles.primaryText}>Upload now</Text>
                </Pressable>
              )}
              {row.status !== 'uploading' && (
                <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => discard(row)}>
                  <Text style={[styles.secondaryText, { color: colors.error }]}>Discard</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          {/* Inner Pressable stops taps on the sheet from closing it. */}
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            {selected && (() => {
              const result = selected.server_result_json ? JSON.parse(selected.server_result_json) : {};
              let localSkipped = [];
              try { localSkipped = JSON.parse(selected.local_skipped_json || '[]'); } catch { localSkipped = []; }
              return (
                <ScrollView>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{selected.file_name}</Text>
                  <Text style={[styles.small, { color: colors.textMuted }]}>
                    {new Date(selected.created_at).toLocaleString()}
                  </Text>
                  <Text style={[styles.body, { color: colors.textPrimary }]}>Status: {STATUS_LABEL[selected.status]}</Text>
                  <Text style={[styles.body, { color: colors.textPrimary }]}>Imported: {result.imported ?? 0}</Text>
                  <Text style={[styles.body, { color: colors.textPrimary }]}>Skipped by server: {result.skipped ?? 0}</Text>
                  {localSkipped.length > 0 && (
                    <>
                      <Text style={[styles.label, { color: colors.textMuted, marginTop: 14 }]}>ROWS SKIPPED BEFORE UPLOAD</Text>
                      {localSkipped.slice(0, SHOW_SKIPPED).map((r, i) => (
                        <Text key={`${r.row}-${r.column}-${i}`} style={[styles.small, { color: colors.textMuted }]}>
                          Row {r.row}, {r.column}: {r.reason}
                        </Text>
                      ))}
                    </>
                  )}
                  <Text style={[styles.small, { color: colors.textMuted, marginTop: 14 }]}>
                    These students are saved on the server. Clearing only removes this entry from the list.
                  </Text>
                  <View style={styles.row}>
                    <Pressable style={[styles.secondaryButton, styles.flexButton, { borderColor: colors.border }]} onPress={() => discard(selected)}>
                      <Text style={[styles.secondaryText, { color: colors.textMuted }]}>Clear from list</Text>
                    </Pressable>
                    <Pressable style={[styles.primaryButton, styles.flexButton, { backgroundColor: colors.inkSoft }]} onPress={() => setSelected(null)}>
                      <Text style={styles.primaryText}>Close</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  small: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  mono: { fontSize: 13, marginTop: 6 },
  notice: { fontSize: 13, marginTop: 12 },
  sectionTitle: { fontSize: 15, fontFamily: fontFamily.heading, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  primaryButton: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  secondaryText: { fontWeight: '600', fontSize: 14 },
  flexButton: { flex: 1, marginTop: 0 },
  disabled: { opacity: 0.5 },
  spinner: { marginTop: 14 },
  tapCard: { flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.7 },
  chevron: { fontSize: 28, marginLeft: 8 },
  badge: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, marginTop: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
});

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
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
} from '../services/stagedImports';

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

  const refresh = useCallback(async () => {
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
    Alert.alert(
      'Discard import?',
      `Remove "${row.file_name}" from this phone? Its students will not be saved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            const r = await discardStagedImport(row.import_key);
            if (!r.ok) Alert.alert('Cannot discard', r.message);
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
        <Text style={[styles.label, { color: colors.textMuted }]}>Required columns, in this order</Text>
        <Text style={[styles.mono, { color: colors.textPrimary }]}>{HEADER.join(', ')}</Text>
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
      {staged.map((row) => (
        <View key={row.import_key} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{row.file_name}</Text>
          <Text style={[styles.small, { color: colors.textMuted }]}>
            {new Date(row.created_at).toLocaleString()} · {STATUS_LABEL[row.status] || row.status}
          </Text>
          <Text style={[styles.body, { color: colors.textPrimary }]}>Ready: {row.ready_count}</Text>
          {row.status === 'completed' && row.server_result_json && (
            <Text style={[styles.small, { color: colors.textPrimary }]}>
              Server: {JSON.parse(row.server_result_json).imported} imported, {JSON.parse(row.server_result_json).skipped} skipped.
            </Text>
          )}
          {row.error_code && row.status !== 'completed' && (
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
      ))}
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
});

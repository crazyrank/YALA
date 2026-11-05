import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api } from '../api/client';
import { formatDobInput } from '../utils/dobFormat';
import {
  BIODATA_ROLES,
  LIVING_WITH_OPTIONS,
  FIELD_GROUPS,
  toForm,
  buildPatch,
  displayValue,
} from '../utils/biodataForm';

/**
 * Biodata for one student. Online only and staff only.
 * Nothing is fetched until a staff member taps "Open biodata", and the data is
 * dropped from memory again when the section is closed.
 */
export default function StudentBiodataSection({ studentId, role }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  if (!BIODATA_ROLES.includes(role)) return null;

  const messageFor = (err) =>
    err && err.isNetworkError
      ? 'Biodata needs an internet connection. Connect and try again.'
      : (err && err.message) || 'Something went wrong. Try again.';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/student-biodata/${studentId}`);
      setData(res.biodata);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  };

  const openSection = () => {
    setOpen(true);
    load();
  };

  const closeSection = () => {
    setOpen(false);
    setEditing(false);
    setData(null);
    setError('');
  };

  const startEdit = () => {
    setForm(toForm(data));
    setEditing(true);
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const result = buildPatch(data, form);
    if (result.error) {
      Alert.alert('Check the form', result.error);
      return;
    }
    if (Object.keys(result.patch).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch(`/student-biodata/${studentId}`, result.patch);
      setData(res.biodata);
      setEditing(false);
    } catch (err) {
      Alert.alert('Could not save', messageFor(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <View style={styles.section}>
        <Text style={styles.eyebrow}>BIODATA</Text>
        <Pressable style={styles.openButton} onPress={openSection}>
          <Text style={styles.openButtonText}>Open biodata</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>BIODATA</Text>
        <Pressable onPress={closeSection} disabled={saving}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator style={styles.loader} color="#17263B" />}

      {!loading && error !== '' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!loading && error === '' && data && !editing && (
        <>
          {FIELD_GROUPS.map((group) => (
            <View key={group.title} style={styles.groupBlock}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.card}>
                {group.fields.map((f, i) => (
                  <View
                    key={f.key}
                    style={[styles.row, i === group.fields.length - 1 && styles.rowLast]}
                  >
                    <Text style={styles.rowLabel}>{f.label}</Text>
                    <Text style={styles.rowValue}>{displayValue(f, data)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <Pressable style={styles.primaryButton} onPress={startEdit}>
            <Text style={styles.primaryButtonText}>Edit biodata</Text>
          </Pressable>
        </>
      )}

      {!loading && error === '' && data && editing && (
        <>
          {FIELD_GROUPS.map((group) => (
            <View key={group.title} style={styles.groupBlock}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.card}>
                {group.fields.map((f) => (
                  <View key={f.key} style={styles.editField}>
                    <Text style={styles.rowLabel}>{f.label}</Text>
                    {(f.type === 'text' || f.type === 'multiline' || f.type === 'phone') && (
                      <TextInput
                        style={[styles.input, f.type === 'multiline' && styles.inputMulti]}
                        value={form[f.key]}
                        onChangeText={(t) => setField(f.key, t)}
                        maxLength={f.max}
                        multiline={f.type === 'multiline'}
                        keyboardType={f.type === 'phone' ? 'phone-pad' : 'default'}
                        autoCapitalize={f.type === 'phone' ? 'none' : f.caps}
                        autoCorrect={false}
                        editable={!saving}
                      />
                    )}
                    {f.type === 'date' && (
                      <TextInput
                        style={styles.input}
                        value={form[f.key]}
                        onChangeText={(t) => setField(f.key, formatDobInput(t))}
                        placeholder="DD/MM/YYYY"
                        placeholderTextColor="#98A2B3"
                        keyboardType="number-pad"
                        maxLength={10}
                        editable={!saving}
                      />
                    )}
                    {f.type === 'bool' && (
                      <View style={styles.chipRow}>
                        {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map((o) => (
                          <Pressable
                            key={o.l}
                            style={[styles.chip, form[f.key] === o.v && styles.chipOn]}
                            onPress={() => setField(f.key, form[f.key] === o.v ? null : o.v)}
                            disabled={saving}
                          >
                            <Text style={[styles.chipText, form[f.key] === o.v && styles.chipTextOn]}>{o.l}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {f.type === 'living' && (
                      <View style={styles.chipRow}>
                        {LIVING_WITH_OPTIONS.map((o) => (
                          <Pressable
                            key={o.value}
                            style={[styles.chip, form[f.key] === o.value && styles.chipOn]}
                            onPress={() => setField(f.key, form[f.key] === o.value ? '' : o.value)}
                            disabled={saving}
                          >
                            <Text style={[styles.chipText, form[f.key] === o.value && styles.chipTextOn]}>{o.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={() => setEditing(false)} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButtonFlex} onPress={save} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18 },
  eyebrow: { fontSize: 11, fontWeight: '700', color: '#98A2B3', letterSpacing: 1, marginBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeText: { fontSize: 13, fontWeight: '700', color: '#17263B', marginBottom: 8 },
  openButton: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0',
    paddingVertical: 14, alignItems: 'center',
  },
  openButtonText: { fontSize: 14, fontWeight: '700', color: '#17263B' },
  loader: { marginVertical: 20 },
  errorBox: { backgroundColor: '#FEF3F2', borderRadius: 12, padding: 14 },
  errorText: { fontSize: 13, color: '#B42318' },
  retryButton: { marginTop: 10, alignSelf: 'flex-start' },
  retryText: { fontSize: 13, fontWeight: '700', color: '#17263B' },
  groupBlock: { marginBottom: 14 },
  groupTitle: { fontSize: 11, fontWeight: '700', color: '#98A2B3', letterSpacing: 1, marginBottom: 6 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#EAECF0',
    paddingHorizontal: 16, paddingVertical: 4,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2F4F7',
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: '#667085', flexShrink: 1, paddingRight: 12 },
  rowValue: { fontSize: 13, fontWeight: '600', color: '#0E1A2B', maxWidth: '60%', textAlign: 'right' },
  editField: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F4F7' },
  input: {
    marginTop: 6, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0E1A2B', backgroundColor: '#FFFFFF',
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: {
    borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 6,
  },
  chipOn: { backgroundColor: '#17263B', borderColor: '#17263B' },
  chipText: { fontSize: 13, color: '#344054', fontWeight: '600' },
  chipTextOn: { color: '#FFFFFF' },
  buttonRow: { flexDirection: 'row', marginTop: 4 },
  cancelButton: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD',
    paddingVertical: 12, alignItems: 'center', marginRight: 10,
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  primaryButton: { backgroundColor: '#17263B', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryButtonFlex: { flex: 1, backgroundColor: '#17263B', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});

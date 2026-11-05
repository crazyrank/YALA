import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { triggerSync } from '../services/syncEngine';
import {
  pullAlumni, listAlumni, createAlumni, updateAlumni,
} from '../services/alumniLocal';

// Admins only (Principal, Director, Head Teacher). Works offline.
// Head Teachers see only their own division. Nothing can be deleted.

const ADMIN_ROLES = ['principal', 'director', 'head_teacher'];

const FILTERS = [
  { key: 'contactable', label: 'Active' },
  { key: 'opted_out', label: 'Opted out' },
  { key: 'deceased', label: 'Deceased' },
  { key: 'all', label: 'All' },
];
const DIVISIONS = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
];
const STATUSES = [
  { key: 'contactable', label: 'Contactable' },
  { key: 'opted_out', label: 'Opted out' },
  { key: 'deceased', label: 'Deceased' },
];
const TEXT_FIELDS = [
  ['fullName', 'Full name'],
  ['graduationSession', 'Graduation session'],
  ['lastClassLevel', 'Last class'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['address', 'Home address'],
  ['notes', 'Notes'],
];

function emptyValues() {
  return {
    fullName: '', division: '', graduationSession: '', lastClassLevel: '',
    phone: '', email: '', address: '', notes: '', contactStatus: 'contactable',
  };
}

function valuesFromRow(r) {
  return {
    fullName: r.full_name || '',
    division: r.division || '',
    graduationSession: r.graduation_session || '',
    lastClassLevel: r.last_class_level || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    notes: r.notes || '',
    contactStatus: r.contact_status || 'contactable',
  };
}

export default function AlumniScreen() {
  const { user } = useAuth();
  const allowed = ADMIN_ROLES.includes(user?.role);
  // The server enforces division limits on sync. The phone uses this list for early checks.
  const allowedDivisions = Array.isArray(user?.divisions) ? user.divisions : null;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('contactable');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null); // { mode: 'new' | 'edit', id, values }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      // Refresh from the server when possible. Offline, show what is already on the phone.
      const rows = await pullAlumni().catch(() => listAlumni());
      setRecords(rows);
    } catch (err) {
      Alert.alert('Could not load alumni', (err && err.message) || 'Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    load();
    triggerSync();
  }, [allowed, load]));

  const refresh = () => {
    setRefreshing(true);
    triggerSync();
    load();
  };

  const setField = (key, value) => {
    setEditor((prev) => (prev ? { ...prev, values: { ...prev.values, [key]: value } } : prev));
  };

  const save = async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const res = editor.mode === 'new'
        ? await createAlumni({ fields: editor.values, allowedDivisions })
        : await updateAlumni({ id: editor.id, fields: editor.values, allowedDivisions });
      if (!res.ok) {
        Alert.alert('Could not save', res.message);
        return;
      }
      setEditor(null);
      await load();
    } catch (err) {
      Alert.alert('Could not save', (err && err.message) || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Only administrators can open the alumni list.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const search = query.trim().toLowerCase();
  const visible = records.filter((r) => (
    (filter === 'all' || r.contact_status === filter)
    && (!search || (r.full_name || '').toLowerCase().includes(search))
  ));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {editor ? (
        <View style={styles.card}>
          <Text style={styles.heading}>{editor.mode === 'new' ? 'Add alumni' : 'Edit alumni'}</Text>

          {TEXT_FIELDS.map(([key, label]) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={editor.values[key]}
                onChangeText={(t) => setField(key, t)}
                maxLength={500}
              />
            </View>
          ))}

          <Text style={styles.label}>Division</Text>
          <View style={styles.row}>
            {DIVISIONS.map((d) => (
              <Pressable
                key={d.key}
                style={[styles.chip, editor.values.division === d.key && styles.chipOn]}
                onPress={() => setField('division', d.key)}
              >
                <Text style={[styles.chipText, editor.values.division === d.key && styles.chipTextOn]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Contact status</Text>
          <View style={styles.row}>
            {STATUSES.map((s) => (
              <Pressable
                key={s.key}
                style={[styles.chip, editor.values.contactStatus === s.key && styles.chipOn]}
                onPress={() => setField('contactStatus', s.key)}
              >
                <Text style={[styles.chipText, editor.values.contactStatus === s.key && styles.chipTextOn]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Pressable style={styles.button} onPress={save} disabled={saving}>
              <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
            <Pressable onPress={() => setEditor(null)}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.button} onPress={() => setEditor({ mode: 'new', id: null, values: emptyValues() })}>
          <Text style={styles.buttonText}>Add alumni</Text>
        </Pressable>
      )}

      <TextInput
        style={[styles.input, styles.search]}
        placeholder="Search by name"
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.row}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipOn]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {visible.length === 0 ? <Text style={styles.muted}>No alumni in this list.</Text> : null}

      {visible.map((r) => (
        <Pressable
          key={r.id}
          style={styles.card}
          onPress={() => setEditor({ mode: 'edit', id: r.id, values: valuesFromRow(r) })}
        >
          <Text style={styles.name}>{r.full_name}</Text>
          <Text style={styles.meta}>
            {r.division ? (r.division === 'primary' ? 'Primary' : 'Secondary') : 'No division set'}
            {r.last_class_level ? `  |  ${r.last_class_level}` : ''}
            {r.graduation_session ? `  |  ${r.graduation_session}` : ''}
          </Text>
          {r.contact_status !== 'contactable' ? (
            <Text style={styles.status}>
              {r.contact_status === 'deceased' ? 'Deceased' : 'Opted out of contact'}
            </Text>
          ) : null}
          {r.local_dirty === 1 ? <Text style={styles.pending}>Waiting to sync</Text> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f5f0' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f7f5f0' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2ddd0' },
  heading: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 8 },
  label: { fontSize: 13, color: '#555', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, backgroundColor: '#fff', color: '#111' },
  search: { marginVertical: 12 },
  button: { backgroundColor: '#8a6d1d', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginTop: 4, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#8a6d1d', borderColor: '#8a6d1d' },
  chipText: { color: '#333' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  link: { color: '#8a6d1d', fontWeight: '600', marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#111' },
  meta: { fontSize: 13, color: '#666', marginTop: 4 },
  status: { fontSize: 12, color: '#a33', marginTop: 4 },
  pending: { fontSize: 12, color: '#8a6d1d', marginTop: 4 },
  muted: { color: '#777', textAlign: 'center', marginVertical: 12 },
});

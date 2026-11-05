import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { triggerSync } from '../services/syncEngine';
import {
  pullBlackBook, listBlackBook, createBlackBookEntry, correctBlackBookEntry,
} from '../services/blackBookLocal';

// Principal only. Works offline: entries are saved on the phone and sent on the next sync.

function prettyDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BlackBookScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? user?.userId;
  const allowed = user?.role === 'principal';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const load = useCallback(async () => {
    try {
      // Refresh from the server when possible. Offline, show what is already on the phone.
      const rows = await pullBlackBook().catch(() => listBlackBook());
      setEntries(rows);
    } catch (err) {
      Alert.alert('Could not load the Black Book', (err && err.message) || 'Try again.');
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

  const save = async () => {
    setSaving(true);
    try {
      const res = await createBlackBookEntry({ userId, body: draft });
      if (!res.ok) {
        Alert.alert('Could not save the entry', res.message);
        return;
      }
      setDraft('');
      await load();
    } catch (err) {
      Alert.alert('Could not save the entry', (err && err.message) || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const res = await correctBlackBookEntry({ userId, id, body: editText });
      if (!res.ok) {
        Alert.alert('Could not save the correction', res.message);
        return;
      }
      setEditingId(null);
      setEditText('');
      await load();
    } catch (err) {
      Alert.alert('Could not save the correction', (err && err.message) || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Only the Principal can open the Black Book.</Text>
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.card}>
        <Text style={styles.heading}>New entry</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="Write the entry"
          value={draft}
          onChangeText={setDraft}
          maxLength={4000}
        />
        <Pressable style={styles.button} onPress={save} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save entry'}</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? <Text style={styles.muted}>No entries yet.</Text> : null}

      {entries.map((e) => (
        <View key={e.id} style={styles.card}>
          <Text style={styles.meta}>
            {prettyDate(e.written_at)}
            {e.correction_count > 0 ? '  (corrected)' : ''}
          </Text>

          {editingId === e.id ? (
            <>
              <TextInput
                style={styles.input}
                multiline
                value={editText}
                onChangeText={setEditText}
                maxLength={4000}
              />
              <View style={styles.row}>
                <Pressable style={styles.button} onPress={() => saveEdit(e.id)} disabled={saving}>
                  <Text style={styles.buttonText}>Save correction</Text>
                </Pressable>
                <Pressable onPress={() => setEditingId(null)}>
                  <Text style={styles.link}>Cancel</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.body}>{e.body}</Text>
              {e.original_body ? (
                <Text style={styles.original}>First wording: {e.original_body}</Text>
              ) : null}
              {e.local_dirty === 1 ? <Text style={styles.pending}>Waiting to sync</Text> : null}
              {e.written_by === userId ? (
                <Pressable onPress={() => { setEditingId(e.id); setEditText(e.body); }}>
                  <Text style={styles.link}>Correct</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
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
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, minHeight: 60, textAlignVertical: 'top', backgroundColor: '#fff', color: '#111' },
  button: { backgroundColor: '#8a6d1d', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginTop: 10, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  meta: { fontSize: 12, color: '#777', marginBottom: 6 },
  body: { fontSize: 15, color: '#111', lineHeight: 21 },
  original: { fontSize: 12, color: '#777', marginTop: 6, fontStyle: 'italic' },
  pending: { fontSize: 12, color: '#8a6d1d', marginTop: 6 },
  link: { color: '#8a6d1d', fontWeight: '600', marginTop: 8 },
  muted: { color: '#777', textAlign: 'center', marginVertical: 12 },
});

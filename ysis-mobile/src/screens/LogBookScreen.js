import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Online only. The server checks the role, the class, the date and the 24-hour window again.
const MAX_BODY = 4000;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Local calendar day, offsetDays back from today, as YYYY-MM-DD. */
function dayAgo(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function prettyDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function LogBookScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? user?.userId;
  const canWrite = user?.role === 'class_teacher';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const [draft, setDraft] = useState('');
  const [draftDay, setDraftDay] = useState(0);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/log-entries?from=${dayAgo(14)}&to=${dayAgo(0)}&limit=200`);
      setEntries(res?.entries || []);
      setOffline(false);
    } catch (err) {
      if (err?.isNetworkError) {
        setOffline(true);
      } else {
        Alert.alert('Could not load the Log Book', err?.message || 'Try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      Alert.alert('Write something', 'The entry cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/log-entries', { entryDate: dayAgo(draftDay), body: text });
      setDraft('');
      setDraftDay(0);
      await load();
    } catch (err) {
      Alert.alert(
        'Could not save the entry',
        err?.isNetworkError ? 'The Log Book needs an internet connection.' : (err?.message || 'Try again.')
      );
    } finally {
      setSaving(false);
    }
  };

  const canCorrect = (entry) =>
    entry.written_by === userId &&
    Date.now() - new Date(entry.written_at).getTime() <= EDIT_WINDOW_MS;

  const saveEdit = async () => {
    const text = editText.trim();
    if (!text) {
      Alert.alert('Write something', 'The entry cannot be empty.');
      return;
    }
    setSavingEdit(true);
    try {
      await api.patch(`/log-entries/${editingId}`, { body: text });
      setEditingId(null);
      setEditText('');
      await load();
    } catch (err) {
      Alert.alert(
        'Could not save the correction',
        err?.isNetworkError ? 'The Log Book needs an internet connection.' : (err?.message || 'Try again.')
      );
    } finally {
      setSavingEdit(false);
    }
  };

  // Group the entries by day, newest day first. The list is already sorted by the server.
  const days = [];
  for (const entry of entries) {
    const last = days[days.length - 1];
    if (last && last.day === entry.entry_date) {
      last.items.push(entry);
    } else {
      days.push({ day: entry.entry_date, items: [entry] });
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      {offline && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>The Log Book needs an internet connection. Showing nothing until you are online.</Text>
        </View>
      )}

      {canWrite && (
        <View style={styles.card}>
          <Text style={styles.heading}>New entry for your class</Text>
          <View style={styles.chips}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Pressable
                key={n}
                style={[styles.chip, draftDay === n && styles.chipOn]}
                onPress={() => setDraftDay(n)}
                disabled={saving}
              >
                <Text style={[styles.chipText, draftDay === n && styles.chipTextOn]}>
                  {n === 0 ? 'Today' : prettyDay(dayAgo(n))}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="What happened in the class today?"
            multiline
            maxLength={MAX_BODY}
            editable={!saving}
          />
          <Pressable style={[styles.button, saving && styles.disabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save entry</Text>}
          </Pressable>
        </View>
      )}

      {loading && <ActivityIndicator style={styles.spinner} />}

      {!loading && !offline && days.length === 0 && (
        <Text style={styles.body}>No entries in the last two weeks.</Text>
      )}

      {days.map((group) => (
        <View key={group.day} style={styles.dayBlock}>
          <Text style={styles.dayTitle}>{prettyDay(group.day)}</Text>
          {group.items.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <Text style={styles.meta}>
                {entry.class_level}{entry.arm ? ` (${entry.arm})` : ''} · {entry.written_by_name || 'Class teacher'}
                {entry.corrected_at ? ' · corrected' : ''}
              </Text>

              {editingId === entry.id ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                    maxLength={MAX_BODY}
                    editable={!savingEdit}
                  />
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.secondary}
                      onPress={() => { setEditingId(null); setEditText(''); }}
                      disabled={savingEdit}
                    >
                      <Text style={styles.secondaryText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.button} onPress={saveEdit} disabled={savingEdit}>
                      {savingEdit ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save correction</Text>}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.entryText}>{entry.body}</Text>
                  {canCorrect(entry) && (
                    <Pressable
                      style={styles.secondary}
                      onPress={() => { setEditingId(entry.id); setEditText(entry.body); }}
                    >
                      <Text style={styles.secondaryText}>Correct this entry</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 16, paddingBottom: 40 },
  spinner: { marginTop: 14 },
  body: { fontSize: 14, color: '#5B6472', marginTop: 8 },
  notice: { backgroundColor: '#FEF0C7', borderRadius: 10, padding: 12, marginBottom: 12 },
  noticeText: { fontSize: 13, color: '#7A4B00' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E6EC' },
  heading: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 10 },
  dayBlock: { marginTop: 6 },
  dayTitle: { fontSize: 14, fontWeight: '700', color: '#344054', marginBottom: 6, marginTop: 6 },
  meta: { fontSize: 12, color: '#5B6472', marginBottom: 6 },
  entryText: { fontSize: 14, color: '#101828', lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1.5, borderColor: '#D0D5DD', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#FFFFFF' },
  chipOn: { borderColor: '#1D3557', backgroundColor: '#1D3557' },
  chipText: { fontSize: 12, color: '#344054' },
  chipTextOn: { color: '#FFFFFF', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, backgroundColor: '#FFFFFF', marginBottom: 10 },
  button: { backgroundColor: '#1D3557', borderRadius: 10, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 14, marginTop: 6 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondary: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 8, paddingHorizontal: 14 },
  secondaryText: { color: '#344054', fontWeight: '600', fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  disabled: { opacity: 0.6 },
});

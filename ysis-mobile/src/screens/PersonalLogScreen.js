import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import {
  listPersonalLog, addPersonalLog, updatePersonalLog, setPersonalLogPinned, deletePersonalLog,
} from '../services/personalLogLocal';

// Principal only. Notes stay on this phone and are never sent to the server.

function dayKey(iso) {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayLabel(key) {
  const today = dayKey(new Date().toISOString());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return 'Today';
  if (key === dayKey(y.toISOString())) return 'Yesterday';
  const [yy, mm, dd] = key.split('-').map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function timeLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function PersonalLogScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? user?.userId;
  const allowed = user?.role === 'principal';

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const load = useCallback(async () => {
    try {
      setNotes(await listPersonalLog(userId));
    } catch (err) {
      Alert.alert('Could not load your log', (err && err.message) || 'Try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    load();
  }, [allowed, load]));

  const save = async () => {
    setSaving(true);
    try {
      const res = await addPersonalLog({ userId, body: draft });
      if (!res.ok) {
        Alert.alert('Could not save', res.message);
        return;
      }
      setDraft('');
      await load();
    } catch (err) {
      Alert.alert('Could not save', (err && err.message) || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const res = await updatePersonalLog({ userId, id, body: editText });
      if (!res.ok) {
        Alert.alert('Could not save', res.message);
        return;
      }
      setEditingId(null);
      setEditText('');
      await load();
    } catch (err) {
      Alert.alert('Could not save', (err && err.message) || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (note) => {
    try {
      await setPersonalLogPinned({ userId, id: note.id, pinned: !note.pinned });
      await load();
    } catch (err) {
      Alert.alert('Could not update', (err && err.message) || 'Try again.');
    }
  };

  const confirmDelete = (note) => {
    Alert.alert('Delete this note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePersonalLog({ userId, id: note.id });
            await load();
          } catch (err) {
            Alert.alert('Could not delete', (err && err.message) || 'Try again.');
          }
        },
      },
    ]);
  };

  const { pinned, groups } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes;
    const byDay = [];
    for (const n of shown.filter((x) => !x.pinned)) {
      const key = dayKey(n.created_at);
      const last = byDay[byDay.length - 1];
      if (last && last.day === key) last.items.push(n);
      else byDay.push({ day: key, items: [n] });
    }
    return { pinned: shown.filter((x) => x.pinned), groups: byDay };
  }, [notes, query]);

  const s = makeStyles(colors);

  if (!allowed) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Only the Principal can open this log.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const renderNote = (n) => (
    <View key={n.id} style={s.card}>
      <View style={s.metaRow}>
        <Text style={s.meta}>
          {timeLabel(n.created_at)}
          {n.updated_at && n.updated_at !== n.created_at ? '  (edited)' : ''}
        </Text>
        {n.pinned ? <Ionicons name="pin" size={14} color={colors.warning} /> : null}
      </View>

      {editingId === n.id ? (
        <>
          <TextInput
            style={s.input}
            multiline
            value={editText}
            onChangeText={setEditText}
            maxLength={4000}
            placeholderTextColor={colors.textMuted}
          />
          <View style={s.row}>
            <Pressable style={[s.button, saving && s.disabled]} onPress={() => saveEdit(n.id)} disabled={saving}>
              <Text style={s.buttonText}>Save</Text>
            </Pressable>
            <Pressable onPress={() => { setEditingId(null); setEditText(''); }}>
              <Text style={s.link}>Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={s.body}>{n.body}</Text>
          <View style={s.row}>
            <Pressable onPress={() => togglePin(n)} hitSlop={8}>
              <Text style={s.link}>{n.pinned ? 'Unpin' : 'Pin'}</Text>
            </Pressable>
            <Pressable onPress={() => { setEditingId(n.id); setEditText(n.body); }} hitSlop={8}>
              <Text style={s.link}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => confirmDelete(n)} hitSlop={8}>
              <Text style={[s.link, { color: colors.error }]}>Delete</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.heading}>Write anything</Text>
          <TextInput
            style={s.input}
            multiline
            placeholder="A thought, a reminder, something that happened..."
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            maxLength={4000}
          />
          <Pressable style={[s.button, saving && s.disabled]} onPress={save} disabled={saving}>
            <Text style={s.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
          <Text style={s.privacy}>Private to you. Saved on this phone only.</Text>
        </View>

        {notes.length > 0 ? (
          <TextInput
            style={[s.input, s.search]}
            placeholder="Search your log"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        ) : null}

        {notes.length === 0 ? <Text style={s.muted}>Nothing here yet. Your notes will appear here.</Text> : null}
        {notes.length > 0 && pinned.length === 0 && groups.length === 0 ? (
          <Text style={s.muted}>No notes match your search.</Text>
        ) : null}

        {pinned.length > 0 ? (
          <View style={s.dayBlock}>
            <Text style={s.dayTitle}>Pinned</Text>
            {pinned.map(renderNote)}
          </View>
        ) : null}

        {groups.map((g) => (
          <View key={g.day} style={s.dayBlock}>
            <Text style={s.dayTitle}>{dayLabel(g.day)}</Text>
            {g.items.map(renderNote)}
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.background },
    card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: c.border },
    heading: { fontSize: 16, fontWeight: '700', color: c.textPrimary, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 10, minHeight: 60, textAlignVertical: 'top', backgroundColor: c.background, color: c.textPrimary },
    search: { minHeight: 44, marginBottom: 12, backgroundColor: c.surface },
    button: { backgroundColor: c.brand, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, marginTop: 10, alignSelf: 'flex-start' },
    disabled: { opacity: 0.6 },
    buttonText: { color: '#FFFFFF', fontWeight: '700' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    meta: { fontSize: 12, color: c.textMuted },
    body: { fontSize: 15, color: c.textPrimary, lineHeight: 21 },
    link: { color: c.brandDark, fontWeight: '700' },
    privacy: { fontSize: 12, color: c.textMuted, marginTop: 10 },
    dayBlock: { marginTop: 6 },
    dayTitle: { fontSize: 13, fontWeight: '700', color: c.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
    muted: { color: c.textMuted, textAlign: 'center', marginVertical: 14 },
  });
}

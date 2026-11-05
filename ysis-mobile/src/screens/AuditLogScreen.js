import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius } from '../theme/spacing';
import { api } from '../api/client';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function prettyAction(action) {
  const s = String(action || '').replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogScreen() {
  const { colors } = useTheme();
  const [staff, setStaff] = useState([]);
  const [personId, setPersonId] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (from && !DATE_RE.test(from)) {
      setError('Use the date format YYYY-MM-DD for From.');
      return;
    }
    if (to && !DATE_RE.test(to)) {
      setError('Use the date format YYYY-MM-DD for To.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const parts = ['limit=200'];
      if (from) parts.push(`from=${encodeURIComponent(from)}`);
      if (to) parts.push(`to=${encodeURIComponent(to)}`);
      if (personId) parts.push(`userId=${encodeURIComponent(personId)}`);
      const res = await api.get(`/audit-logs?${parts.join('&')}`);
      setEntries(res.entries || []);
    } catch (e) {
      setError(e.message || 'Could not load the audit log.');
    } finally {
      setLoading(false);
    }
  }, [from, to, personId]);

  useEffect(() => {
    load();
    api
      .get('/staff-profiles')
      .then((r) => setStaff(r.staff || []))
      .catch(() => setStaff([]));
    // Load once when the screen opens. Later loads run from the Apply button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chip = (key, label, on, onPress) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: colors.border, backgroundColor: on ? colors.ink : colors.surface },
      ]}
    >
      <Text style={[styles.chipText, { color: on ? colors.textInverse : colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.note, { color: colors.textMuted }]}>
        Read only. Shows what was done in the app, by whom and when. Needs an internet connection.
      </Text>

      <Text style={[styles.label, { color: colors.textMuted }]}>PERSON</Text>
      <View style={styles.chipRow}>
        {chip('all', 'Everyone', personId === null, () => setPersonId(null))}
        {staff.map((s) => chip(s.id, s.fullName, personId === s.id, () => setPersonId(s.id)))}
      </View>

      <Text style={[styles.label, { color: colors.textMuted }]}>FROM (YYYY-MM-DD)</Text>
      <TextInput
        value={from}
        onChangeText={setFrom}
        placeholder="For example 2026-09-01"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>TO (YYYY-MM-DD)</Text>
      <TextInput
        value={to}
        onChangeText={setTo}
        placeholder="For example 2026-11-30"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
      />

      <Pressable onPress={load} style={[styles.applyBtn, { backgroundColor: colors.gold }]}>
        <Text style={styles.applyText}>Apply filters</Text>
      </Pressable>

      {!!error && <Text style={[styles.note, { color: colors.error }]}>{error}</Text>}
      {loading && <ActivityIndicator style={{ marginTop: 16 }} color={colors.gold} />}

      {!loading && !error && entries.length === 0 && (
        <Text style={[styles.note, { color: colors.textMuted }]}>No entries match these filters.</Text>
      )}

      {!loading &&
        entries.map((e) => {
          const failed = e.result !== 'success';
          return (
            <View
              key={e.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.cardTop}>
                <Text style={[styles.action, { color: colors.textPrimary }]} numberOfLines={2}>
                  {prettyAction(e.action)}
                </Text>
                {failed && (
                  <Text style={[styles.badge, { color: colors.error, borderColor: colors.error }]}>
                    {e.result}
                  </Text>
                )}
              </View>
              <Text style={[styles.sub, { color: colors.textMuted }]}>
                {e.userName || 'System'} · {formatWhen(e.occurredAt)}
              </Text>
              {!!e.entityType && (
                <Text style={[styles.sub, { color: colors.textMuted }]}>
                  About: {e.entityType}
                </Text>
              )}
            </View>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  note: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 6, marginBottom: 10, lineHeight: 19 },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: fontFamily.body,
    fontSize: 15,
  },
  applyBtn: {
    marginTop: 18,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  applyText: { fontFamily: fontFamily.bodyBold, fontSize: 15, color: '#0E1A2B' },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  action: { fontFamily: fontFamily.heading, fontSize: 14, flex: 1 },
  badge: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sub: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 4 },
});

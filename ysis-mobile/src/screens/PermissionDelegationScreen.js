import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius } from '../theme/spacing';
import { api } from '../api/client';
import { cachedGet } from '../services/offlineCache';
import OfflineCacheNote from '../components/OfflineCacheNote';

const ONE_WEEK_HOURS = 168;
const PERMISSION_CODE = 'PROMOTE_STUDENT';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PermissionDelegationScreen() {
  const { colors } = useTheme();
  const [headTeachers, setHeadTeachers] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [users, granted] = await Promise.all([
        cachedGet({ group: 'permissions', key: 'users', path: '/users' }),
        cachedGet({ group: 'permissions', key: 'permissions-delegate', path: '/permissions/delegate' }),
      ]);
      setHeadTeachers(
        (users.users || []).filter((u) => u.role === 'head_teacher' && u.status === 'active')
      );
      setGrants(granted.grants || []);
    } catch (e) {
      setError(e.message || 'Could not load permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const grant = async () => {
    if (!selectedId) {
      Alert.alert('Choose a Head Teacher', 'Pick the Head Teacher who should receive this permission.');
      return;
    }
    if (reason.trim().length < 5) {
      Alert.alert('Reason needed', 'Write a short reason, at least 5 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/permissions/delegate', {
        userId: selectedId,
        permissionCode: PERMISSION_CODE,
        expiresInHours: ONE_WEEK_HOURS,
        reason: reason.trim(),
      });
      setSelectedId(null);
      setReason('');
      await load();
    } catch (e) {
      Alert.alert('Could not grant', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const revoke = (g) => {
    Alert.alert('Revoke permission', `Remove promotion rights from ${g.userName} now?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/permissions/delegate/${g.id}`);
            await load();
          } catch (e) {
            Alert.alert('Could not revoke', e.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <OfflineCacheNote group="permissions" />
      <Text style={[styles.note, { color: colors.textMuted }]}>
        Give a Head Teacher the right to promote students in their own scope for one week. The right ends automatically. You can end it early below.
      </Text>

      {loading && <ActivityIndicator style={{ marginTop: 16 }} color={colors.gold} />}
      {!!error && !loading && <Text style={[styles.note, { color: colors.error }]}>{error}</Text>}

      {!loading && (
        <>
          <Text style={[styles.label, { color: colors.textMuted }]}>HEAD TEACHER</Text>
          {headTeachers.length === 0 && (
            <Text style={[styles.note, { color: colors.textMuted }]}>No active Head Teachers yet.</Text>
          )}
          {headTeachers.map((h) => {
            const on = selectedId === h.id;
            return (
              <Pressable
                key={h.id}
                onPress={() => setSelectedId(h.id)}
                style={[
                  styles.option,
                  {
                    borderColor: colors.border,
                    backgroundColor: on ? colors.ink : colors.surface,
                  },
                ]}
              >
                <Text style={[styles.optionText, { color: on ? colors.textInverse : colors.textPrimary }]}>
                  {h.fullName}
                </Text>
              </Pressable>
            );
          })}

          <Text style={[styles.label, { color: colors.textMuted }]}>REASON</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
            placeholder="Why this right is needed for the week"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          />

          <Pressable
            disabled={saving}
            onPress={grant}
            style={[styles.grantBtn, { backgroundColor: colors.gold, opacity: saving ? 0.6 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator color="#0E1A2B" />
            ) : (
              <Text style={styles.grantText}>Grant for one week</Text>
            )}
          </Pressable>

          <Text style={[styles.label, { color: colors.textMuted }]}>ACTIVE GRANTS</Text>
          {grants.length === 0 && (
            <Text style={[styles.note, { color: colors.textMuted }]}>No active grants.</Text>
          )}
          {grants.map((g) => (
            <View
              key={g.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.textPrimary }]}>{g.userName}</Text>
                <Text style={[styles.sub, { color: colors.textMuted }]}>
                  Promote students, until {formatDate(g.expiresAt)}
                </Text>
                <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={2}>
                  {g.reason}
                </Text>
              </View>
              <Pressable onPress={() => revoke(g)} style={[styles.revokeBtn, { borderColor: colors.error }]}>
                <Text style={[styles.revokeText, { color: colors.error }]}>Revoke</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
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
    marginTop: 18,
    marginBottom: 8,
  },
  option: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionText: { fontFamily: fontFamily.bodySemibold, fontSize: 15 },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: fontFamily.body,
    fontSize: 15,
  },
  grantBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  grantText: { fontFamily: fontFamily.bodyBold, fontSize: 15, color: '#0E1A2B' },
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
  sub: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 3 },
  revokeBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  revokeText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
});

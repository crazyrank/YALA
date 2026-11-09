import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';

// Mirrors the server rules in POST /auth/reset-password. The server enforces them again.
const CAN_RESET = {
  director: ['head_teacher', 'principal', 'class_teacher'],
  principal: ['head_teacher', 'class_teacher'],
};

const ROLE_LABEL = {
  head_teacher: 'Head Teacher',
  principal: 'Principal',
  class_teacher: 'Class Teacher',
};

export default function PasswordResetScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [issued, setIssued] = useState(null);
  const [error, setError] = useState('');

  const allowedRoles = CAN_RESET[user?.role] || [];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get('/users');
      setStaff(result.users || []);
    } catch (err) {
      setError(err.message || 'Could not load staff accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (allowedRoles.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          Password reset is only available to the director and principal.
        </Text>
      </View>
    );
  }

  const targets = staff.filter((u) => allowedRoles.includes(u.role) && u.id !== user?.id);

  const reset = async (person) => {
    setBusyId(person.id);
    setError('');
    try {
      const result = await api.post('/auth/reset-password', { targetUserId: person.id });
      setIssued({
        name: person.full_name,
        tempCredential: result.tempCredential,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      setError(err.message || 'The password could not be reset.');
    } finally {
      setBusyId('');
    }
  };

  const confirmReset = (person) => {
    Alert.alert(
      'Reset password?',
      `Issue a temporary password for ${person.full_name}? Share it only with that person.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => reset(person) },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {error ? <Text style={[styles.message, { color: colors.error }]}>{error}</Text> : null}

      {issued ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.gold }]}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>Temporary password for {issued.name}</Text>
          <Text style={[styles.code, { color: colors.textPrimary }]}>{issued.tempCredential}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Expires {new Date(issued.expiresAt).toLocaleTimeString()}. It is shown only once. They must change it at first sign-in.
          </Text>
          <Pressable
            onPress={() => setIssued(null)}
            style={[styles.button, { backgroundColor: colors.gold, borderColor: colors.gold, marginTop: 12 }]}
          >
            <Text style={[styles.buttonText, { color: colors.textInverse }]}>Done</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.gold} />
      ) : (
        <FlatList
          data={targets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>No accounts you can reset.</Text>
          }
          renderItem={({ item }) => {
            const busy = busyId === item.id;
            return (
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.textPrimary }]}>{item.full_name}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {ROLE_LABEL[item.role] || item.role}
                    {item.email ? ` · ${item.email}` : ''}
                  </Text>
                </View>
                <Pressable
                  disabled={busy}
                  onPress={() => confirmReset(item)}
                  style={[styles.button, { backgroundColor: colors.gold, borderColor: colors.gold }]}
                >
                  <Text style={[styles.buttonText, { color: colors.textInverse }]}>
                    {busy ? 'Resetting...' : 'Reset'}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { paddingHorizontal: 16, paddingTop: 12, fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, margin: 16 },
  code: { fontSize: 24, fontWeight: '700', letterSpacing: 2, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 4 },
  button: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  buttonText: { fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});

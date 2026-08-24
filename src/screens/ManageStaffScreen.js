import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

/**
 * Lists the staff the caller manages (Director → Principals they created,
 * Principal → Head Teachers they created) via GET /users. Refetches every
 * time this screen comes into focus, since a freshly created account
 * (from CreateAccountScreen) needs to show up immediately on "Done".
 */
export default function ManageStaffScreen({ navigation }) {
  const { user } = useAuth();
  const staffLabel = user?.role === 'director' ? 'Principals' : 'Head Teachers';

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStaff = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await api.get('/users');
      setStaff(result.users || []);
    } catch (err) {
      if (!err.isNetworkError) {
        Alert.alert('Could not load staff', err.message || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStaff();
    }, [loadStaff])
  );

  const toggleStatus = (member) => {
    const nextStatus = member.status === 'active' ? 'suspended' : 'active';
    const verb = nextStatus === 'suspended' ? 'Disable' : 'Re-enable';

    Alert.alert(
      `${verb} account?`,
      `${member.fullName} will ${nextStatus === 'suspended' ? 'no longer be able to sign in.' : 'be able to sign in again.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: nextStatus === 'suspended' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const result = await api.patch(`/users/${member.id}/status`, { status: nextStatus });
              setStaff((prev) => prev.map((s) => (s.id === member.id ? result.user : s)));
            } catch (err) {
              Alert.alert('Could not update account', err.message || 'Something went wrong.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.createButton} onPress={() => navigation.navigate('CreateAccount')}>
        <Text style={styles.createButtonText}>+ Create {staffLabel === 'Principals' ? 'Principal' : 'Head Teacher'}</Text>
      </Pressable>

      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStaff(true)} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              No {staffLabel.toLowerCase()} yet. Tap "+ Create" above to add one.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={[styles.status, item.status === 'active' ? styles.statusActive : styles.statusSuspended]}>
                {item.status === 'active' ? 'Active' : 'Suspended'}
              </Text>
            </View>
            <Pressable style={styles.toggleButton} onPress={() => toggleStatus(item)}>
              <Text style={styles.toggleButtonText}>
                {item.status === 'active' ? 'Disable' : 'Enable'}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  createButton: { backgroundColor: '#c9a24b', margin: 16, paddingVertical: 14, borderRadius: 8 },
  createButtonText: { textAlign: 'center', color: '#0d1f33', fontWeight: '700', fontSize: 15 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyText: { textAlign: 'center', color: '#7a8a99', fontSize: 13, marginTop: 40, lineHeight: 19 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f2ec',
    borderRadius: 10, padding: 14, marginBottom: 10,
  },
  name: { fontSize: 15, fontWeight: '700', color: '#16324f' },
  email: { fontSize: 12.5, color: '#7a8a99', marginTop: 2 },
  status: { fontSize: 11, fontWeight: '700', marginTop: 6, textTransform: 'uppercase' },
  statusActive: { color: '#2f8f4e' },
  statusSuspended: { color: '#b3403a' },
  toggleButton: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#16324f', borderRadius: 6 },
  toggleButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

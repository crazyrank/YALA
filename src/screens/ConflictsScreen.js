import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

export default function ConflictsScreen({ navigation }) {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/conflicts?status=open');
      setConflicts(res.conflicts);
    } catch (err) {
      Alert.alert('Could not load conflicts', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resolve = async (conflictId, resolution) => {
    try {
      await api.post(`/conflicts/${conflictId}/resolve`, { resolution });
      load();
      if (conflicts.length <= 1) {
        // Last conflict resolved — return to dashboard, ConflictBlocker
        // will re-check and unblock automatically.
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Could not resolve', err.message);
    }
  };

  return (
    <FlatList
      style={styles.container}
      data={conflicts}
      refreshing={loading}
      onRefresh={load}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.studentName}>{item.full_name}</Text>
          <Text style={styles.admissionNo}>{item.admission_no}</Text>
          <Text style={styles.summary}>{item.conflict_summary}</Text>

          <View style={styles.compareRow}>
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>Current on server</Text>
              <Text style={styles.compareValue}>{JSON.stringify(item.server_state, null, 2)}</Text>
            </View>
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>Attempted change</Text>
              <Text style={styles.compareValue}>{JSON.stringify(item.incoming_change, null, 2)}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <Pressable style={styles.button} onPress={() => resolve(item.id, 'restore')}>
              <Text style={styles.buttonText}>Apply the Change</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => resolve(item.id, 'keep_deleted')}>
              <Text style={styles.buttonText}>Keep Current</Text>
            </Pressable>
          </View>
        </View>
      )}
      ListHeaderComponent={
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons name="sync" size={18} color="#16324f" />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>System Status</Text>
            <Text style={styles.statusSub}>
              Your student records are stored safely on this device.
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>READY</Text>
          </View>
        </View>
      }
      ListEmptyComponent={!loading && <Text style={styles.empty}>No open conflicts.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f2ec' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 14 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },
  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f8f6f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 13, fontWeight: '700', color: '#16324f' },
  statusSub: { fontSize: 11, color: '#7a8a99', marginTop: 3, lineHeight: 15 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F7EF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1E9E63', marginRight: 5 },
  statusBadgeText: { fontSize: 8, fontWeight: '700', color: '#1E9E63', letterSpacing: 0.3 },
  studentName: { fontSize: 16, fontWeight: '700', color: '#16324f' },
  admissionNo: { fontSize: 12, color: '#7a8a99', marginBottom: 8 },
  summary: { fontSize: 13, color: '#3a4a5a', marginBottom: 12 },
  compareRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  compareCol: { flex: 1, backgroundColor: '#f8f6f0', borderRadius: 6, padding: 8 },
  compareLabel: { fontSize: 10, fontWeight: '700', color: '#c9a24b', marginBottom: 4, textTransform: 'uppercase' },
  compareValue: { fontSize: 10, color: '#3a4a5a', fontFamily: 'monospace' },
  buttonRow: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, backgroundColor: '#16324f', borderRadius: 6, paddingVertical: 10 },
  buttonSecondary: { backgroundColor: '#a83f3f' },
  buttonText: { textAlign: 'center', color: '#fff', fontWeight: '600', fontSize: 12 },
  empty: { textAlign: 'center', color: '#7a8a99', marginTop: 40 },
});

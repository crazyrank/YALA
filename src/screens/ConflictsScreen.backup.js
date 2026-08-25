import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
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
      ListEmptyComponent={!loading && <Text style={styles.empty}>No open conflicts.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f2ec' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 14 },
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

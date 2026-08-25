import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

/**
 * Resolves admission_no collisions from the two-step registration flow
 * (Build Spec Section 6). Principal sees both records side by side and
 * picks which one survives — the other is hard-deleted server-side,
 * since it was never a real second student.
 */
export default function MergeQueueScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/conflicts/admission-merge-queue/list?status=open');
      setItems(res.mergeQueue);
    } catch (err) {
      Alert.alert('Could not load', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resolve = async (item, canonicalId, discardedId) => {
    try {
      await api.post(`/conflicts/admission-merge-queue/${item.id}/resolve`, { canonicalId, discardedId });
      load();
      if (items.length <= 1) navigation.goBack();
    } catch (err) {
      Alert.alert('Could not resolve', err.message);
    }
  };

  return (
    <FlatList
      style={styles.container}
      data={items}
      refreshing={loading}
      onRefresh={load}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.admissionNo}>Admission No: {item.admission_no}</Text>
          <Text style={styles.hint}>Both of these were registered independently while offline. Confirm they're the same student and choose which record to keep.</Text>

          <Pressable style={styles.option} onPress={() => resolve(item, item.record_a_id, item.record_b_id)}>
            <Text style={styles.optionName}>{item.record_a_name}</Text>
            <Text style={styles.optionMeta}>{item.record_a_class}</Text>
            <Text style={styles.optionAction}>Keep this one →</Text>
          </Pressable>

          <Pressable style={styles.option} onPress={() => resolve(item, item.record_b_id, item.record_a_id)}>
            <Text style={styles.optionName}>{item.record_b_name}</Text>
            <Text style={styles.optionMeta}>{item.record_b_class}</Text>
            <Text style={styles.optionAction}>Keep this one →</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={!loading && <Text style={styles.empty}>No duplicate registrations to reconcile.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f2ec' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 14 },
  admissionNo: { fontSize: 14, fontWeight: '700', color: '#16324f', marginBottom: 6 },
  hint: { fontSize: 12, color: '#7a8a99', marginBottom: 14, lineHeight: 17 },
  option: { backgroundColor: '#f8f6f0', borderRadius: 8, padding: 12, marginBottom: 10 },
  optionName: { fontSize: 14, fontWeight: '600', color: '#16324f' },
  optionMeta: { fontSize: 11.5, color: '#7a8a99', marginTop: 2 },
  optionAction: { fontSize: 11.5, color: '#1f8a7a', fontWeight: '600', marginTop: 6 },
  empty: { textAlign: 'center', color: '#7a8a99', marginTop: 40 },
});

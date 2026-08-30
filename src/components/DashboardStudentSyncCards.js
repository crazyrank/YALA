import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { getDb } from '../db';

export default function DashboardStudentSyncCards({ navigation }) {
  const [serverCount, setServerCount] = useState(null);
  const [localCount, setLocalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const loadCounts = useCallback(async () => {
    const db = await getDb();

    const local = await db.getFirstAsync(
      'SELECT COUNT(*) AS count FROM students'
    );

    setLocalCount(Number(local?.count || 0));

    try {
      const response = await api.get('/students?page=1');

      if (Array.isArray(response?.students)) {
        setServerCount(response.students.length);
      }
    } catch {
      // Network failure is expected in offline-first mode.
      // Keep the local count and do not spam the console.
    }

    try {
      const pending = await db.getFirstAsync(
        `SELECT COUNT(*) AS count
         FROM sync_operations
         WHERE status != 'synced'`
      );

      setPendingCount(Number(pending?.count || 0));
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    loadCounts();

    const interval = setInterval(loadCounts, 10000);

    return () => clearInterval(interval);
  }, [loadCounts]);

  const studentCount = serverCount ?? localCount;

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.card}
        onPress={() => navigation?.navigate?.('Students')}
      >
        <Text style={styles.label}>STUDENTS</Text>
        <Text style={styles.value}>{studentCount}</Text>
        <Text style={styles.caption}>
          {serverCount !== null ? 'Synced with server' : 'Saved on this device'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.card, pendingCount > 0 && styles.warningCard]}
        onPress={() => navigation?.navigate?.('Conflicts')}
      >
        <Text style={styles.label}>PENDING SYNC</Text>
        <Text style={styles.value}>{pendingCount}</Text>
        <Text style={styles.caption}>
          {pendingCount > 0
            ? 'Changes waiting to sync'
            : 'Everything is synced'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    elevation: 2,
  },
  warningCard: {
    borderWidth: 1,
    borderColor: '#f0b429',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  value: {
    fontSize: 25,
    fontWeight: '800',
    color: '#16324f',
    marginTop: 4,
  },
  caption: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 3,
  },
});

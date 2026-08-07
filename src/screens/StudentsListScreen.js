import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { api } from '../api/client';
import OfflineMarquee from '../components/OfflineMarquee';

/**
 * Search is local-first: queries the SQLite mirror immediately (works
 * fully offline), then reconciles with the server in the background
 * when online. This is the "instant local operations" pillar in
 * practice — a Head Teacher never waits on a network round-trip just to
 * find a student they already have locally.
 *
 * Search itself is scoped server-side already (the local mirror only
 * ever contains students within this device's assigned classes, per
 * Build Spec Section 8), so no extra scoping logic is needed here — the
 * mirror IS the scope.
 */
export default function StudentsListScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const runLocalSearch = useCallback(async (text) => {
    const db = await getDb();
    const rows = text
      ? await db.getAllAsync(
          `SELECT id, admission_no, full_name, class_level, arm, status
           FROM students WHERE full_name LIKE ? ORDER BY full_name ASC LIMIT 50`,
          [`%${text}%`]
        )
      : await db.getAllAsync(
          `SELECT id, admission_no, full_name, class_level, arm, status
           FROM students ORDER BY full_name ASC LIMIT 50`
        );
    setResults(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      runLocalSearch(query);
      refreshFromServer();
    }, [])
  );

  const refreshFromServer = async () => {
    try {
      const response = await api.get('/students?page=1');
      const db = await getDb();
      for (const s of response.students) {
        // eslint-disable-next-line no-await-in-loop
        await db.runAsync(
          `INSERT INTO students
             (id, admission_no, full_name, division, class_level, arm, status, sync_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             admission_no=excluded.admission_no, full_name=excluded.full_name,
             division=excluded.division, class_level=excluded.class_level, arm=excluded.arm,
             status=excluded.status, sync_version=excluded.sync_version, updated_at=excluded.updated_at
           WHERE students.local_dirty = 0`, // never clobber unsynced local edits
          [s.id, s.admission_no, s.full_name, s.division || 'secondary', s.class_level, s.arm,
            s.status, s.sync_version, new Date().toISOString(), new Date().toISOString()]
        );
      }
      runLocalSearch(query);
    } catch {
      // Offline or server unreachable — local results still stand.
    }
  };

  const handleChange = (text) => {
    setQuery(text);
    runLocalSearch(text);
  };

  return (
    <View style={styles.container}>
      <OfflineMarquee />
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name..."
          value={query}
          onChangeText={handleChange}
        />
        <Pressable style={styles.registerButton} onPress={() => navigation.navigate('RegisterStudent')}>
          <Text style={styles.registerButtonText}>+ Register</Text>
        </Pressable>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
          >
            <View>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.meta}>
                {item.admission_no} · {item.class_level}{item.arm ? ` ${item.arm}` : ''}
              </Text>
            </View>
            <Text style={styles.status}>{item.status}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {query
                ? "No student found by that name yet. If the Principal just registered them, you can enter their admission number directly instead."
                : 'No students yet in your assigned classes.'}
            </Text>
            {query.length > 0 && (
              <Pressable
                style={styles.fallbackButton}
                onPress={() => navigation.navigate('RegisterStudent', { prefillName: query })}
              >
                <Text style={styles.fallbackButtonText}>Enter admission number manually</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchRow: { flexDirection: 'row', padding: 14, gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: '#f4f2ec', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  registerButton: { backgroundColor: '#16324f', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  registerButtonText: { color: '#fff', fontWeight: '600', fontSize: 12.5 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  name: { fontSize: 14.5, fontWeight: '600', color: '#16324f' },
  meta: { fontSize: 12, color: '#7a8a99', marginTop: 2 },
  status: { fontSize: 11, color: '#1f8a7a', textTransform: 'uppercase', fontWeight: '600' },
  empty: { padding: 30, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#7a8a99', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  fallbackButton: { backgroundColor: '#f4ead0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  fallbackButtonText: { color: '#8a6a1f', fontWeight: '600', fontSize: 12.5 },
});

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { api } from '../api/client';
import { exportStudentsToCsv } from '../services/csvExport';
import OfflineMarquee from '../components/OfflineMarquee';
import SyncIssueBanner from '../components/SyncIssueBanner';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function StudentCard({ item, navigation }) {
  const initials = getInitials(item.full_name);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.studentCard,
        pressed && styles.studentCardPressed,
      ]}
      onPress={() =>
        navigation.navigate('StudentDetail', {
          studentId: item.id,
        })
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.studentInfo}>
        <Text style={styles.studentName} numberOfLines={1}>
          {item.full_name}
        </Text>

        <Text style={styles.admission}>
          {item.admission_no || 'No admission number'}
        </Text>

        <View style={styles.classRow}>
          <Text style={styles.classText}>
            {item.class_level || 'Class not assigned'}
            {item.arm ? ` • ${item.arm}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.rightArea}>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {item.status || 'ACTIVE'}
          </Text>
        </View>

        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

export default function StudentsListScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [pullError, setPullError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const runLocalSearch = useCallback(async (text) => {
    const db = await getDb();

    const rows = text.trim()
      ? await db.getAllAsync(
          `SELECT id, admission_no, full_name, class_level, arm, status
           FROM students
           WHERE full_name LIKE ?
              OR admission_no LIKE ?
           ORDER BY full_name ASC
           LIMIT 50`,
          [`%${text}%`, `%${text}%`]
        )
      : await db.getAllAsync(
          `SELECT id, admission_no, full_name, class_level, arm, status
           FROM students
           ORDER BY full_name ASC
           LIMIT 50`
        );

    setResults(rows);
  }, []);

  const refreshFromServer = useCallback(async () => {
    try {
      const response = await api.get('/students?page=1');
      const db = await getDb();

      for (const s of response.students || []) {
        await db.runAsync(
          `INSERT INTO students
             (id, admission_no, full_name, division, class_level, arm, status, sync_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             admission_no=excluded.admission_no,
             full_name=excluded.full_name,
             division=excluded.division,
             class_level=excluded.class_level,
             arm=excluded.arm,
             status=excluded.status,
             sync_version=excluded.sync_version,
             updated_at=excluded.updated_at
           WHERE students.local_dirty = 0`,
          [
            s.id,
            s.admission_no,
            s.full_name,
            s.division || 'secondary',
            s.class_level,
            s.arm,
            s.status,
            s.sync_version,
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        );
      }

      await runLocalSearch(query);
      setPullError(null);
    } catch (err) {
      if (!err.isNetworkError) {
        setPullError(
          err.message || 'Could not reach the server.'
        );
      }
    }
  }, [query, runLocalSearch]);

  useFocusEffect(
    useCallback(() => {
      runLocalSearch(query);
      refreshFromServer();
    }, [query, runLocalSearch, refreshFromServer])
  );

  const handleChange = (text) => {
    setQuery(text);
    runLocalSearch(text);
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await refreshFromServer();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const count = await exportStudentsToCsv();

      if (count === 0) {
        Alert.alert(
          'Nothing to export',
          'There are no student records stored on this device yet.'
        );
      }
    } catch (err) {
      Alert.alert(
        'Export failed',
        err.message || 'Could not export student records.'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <OfflineMarquee />

      <SyncIssueBanner
        pullError={pullError}
        onRetryPull={refreshFromServer}
      />

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#16324F"
          />
        }
        contentContainerStyle={[
          styles.listContent,
          results.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>
                  YALAMATRIX SIS
                </Text>

                <Text style={styles.title}>
                  Students
                </Text>

                <Text style={styles.subtitle}>
                  Manage and access student records.
                </Text>
              </View>

              <View style={styles.countBox}>
                <Text style={styles.countNumber}>
                  {results.length}
                </Text>

                <Text style={styles.countLabel}>
                  SHOWING
                </Text>
              </View>
            </View>

            <View style={styles.searchArea}>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>
                  ⌕
                </Text>

                <TextInput
                  style={styles.searchInput}
                  placeholder="Search students or admission number"
                  placeholderTextColor="#98A2B3"
                  value={query}
                  onChangeText={handleChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {query.length > 0 && (
                  <Pressable
                    onPress={() => handleChange('')}
                    hitSlop={10}
                  >
                    <Text style={styles.clearSearch}>
                      ×
                    </Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.registerButton,
                  pressed && styles.registerPressed,
                ]}
                onPress={() =>
                  navigation.navigate('RegisterStudent')
                }
              >
                <Text style={styles.registerPlus}>
                  +
                </Text>

                <Text style={styles.registerText}>
                  Register
                </Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {query
                  ? 'Search results'
                  : 'Student records'}
              </Text>

              <View style={styles.sectionRight}>
                <Text style={styles.sectionHint}>
                  {results.length} record
                  {results.length === 1 ? '' : 's'}
                </Text>

                <Pressable
                  onPress={handleExport}
                  disabled={exporting}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.exportButton,
                    pressed && styles.exportButtonPressed,
                  ]}
                >
                  {exporting ? (
                    <ActivityIndicator size="small" color="#16324F" />
                  ) : (
                    <Text style={styles.exportButtonText}>
                      Export CSV
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <StudentCard
            item={item}
            navigation={navigation}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                {query ? '⌕' : 'S'}
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              {query
                ? 'No student found'
                : 'No students yet'}
            </Text>

            <Text style={styles.emptyText}>
              {query
                ? 'No matching student was found in the local records. You can search using a name or admission number.'
                : 'Student records assigned to your account will appear here.'}
            </Text>

            {query.length > 0 ? (
              <Pressable
                style={styles.fallbackButton}
                onPress={() =>
                  navigation.navigate(
                    'RegisterStudent',
                    { prefillName: query }
                  )
                }
              >
                <Text style={styles.fallbackButtonText}>
                  Enter admission number manually
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.emptyRegisterButton}
                onPress={() =>
                  navigation.navigate('RegisterStudent')
                }
              >
                <Text style={styles.emptyRegisterText}>
                  + Register first student
                </Text>
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },

  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 30,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 22,
    paddingBottom: 20,
  },

  eyebrow: {
    color: '#667085',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 6,
  },

  title: {
    color: '#101828',
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.7,
  },

  subtitle: {
    color: '#667085',
    fontSize: 12,
    marginTop: 5,
  },

  countBox: {
    minWidth: 68,
    height: 64,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  countNumber: {
    color: '#101828',
    fontSize: 21,
    fontWeight: '900',
  },

  countLabel: {
    color: '#98A2B3',
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },

  searchArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  searchBox: {
    flex: 1,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EAECF0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
  },

  searchIcon: {
    color: '#667085',
    fontSize: 22,
    marginRight: 7,
    marginTop: -2,
  },

  searchInput: {
    flex: 1,
    height: 48,
    color: '#101828',
    fontSize: 12.5,
    paddingVertical: 0,
  },

  clearSearch: {
    color: '#667085',
    fontSize: 21,
    paddingLeft: 5,
  },

  registerButton: {
    height: 50,
    borderRadius: 13,
    backgroundColor: '#16324F',
    paddingHorizontal: 14,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  registerPressed: {
    opacity: 0.82,
  },

  registerPlus: {
    color: '#C9A24B',
    fontSize: 19,
    fontWeight: '400',
    marginRight: 4,
  },

  registerText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  sectionTitle: {
    color: '#101828',
    fontSize: 13,
    fontWeight: '800',
  },

  sectionHint: {
    color: '#98A2B3',
    fontSize: 10,
  },

  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  exportButton: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F4EAD0',
  },

  exportButtonPressed: {
    opacity: 0.78,
  },

  exportButtonText: {
    color: '#8A6A1F',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  studentCard: {
    minHeight: 82,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
    marginBottom: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  studentCardPressed: {
    backgroundColor: '#F8FAFC',
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E9F3F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#1F746A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  studentInfo: {
    flex: 1,
    minWidth: 0,
  },

  studentName: {
    color: '#101828',
    fontSize: 13.5,
    fontWeight: '800',
  },

  admission: {
    color: '#667085',
    fontSize: 10.5,
    marginTop: 3,
  },

  classRow: {
    marginTop: 5,
  },

  classText: {
    color: '#98A2B3',
    fontSize: 9.5,
    fontWeight: '600',
  },

  rightArea: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#12B76A',
    marginRight: 4,
  },

  statusText: {
    color: '#027A48',
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  chevron: {
    color: '#98A2B3',
    fontSize: 21,
    lineHeight: 20,
    marginTop: 7,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60,
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyIconText: {
    color: '#667085',
    fontSize: 24,
    fontWeight: '800',
  },

  emptyTitle: {
    color: '#101828',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },

  emptyText: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 310,
  },

  fallbackButton: {
    backgroundColor: '#F4EAD0',
    borderRadius: 11,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 18,
  },

  fallbackButtonText: {
    color: '#8A6A1F',
    fontSize: 11,
    fontWeight: '800',
  },

  emptyRegisterButton: {
    backgroundColor: '#16324F',
    borderRadius: 11,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 18,
  },

  emptyRegisterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});

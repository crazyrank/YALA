import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { SkeletonClassRow } from '../components/Skeleton';

export default function ClassesScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadClasses = useCallback(async () => {
    const db = await getDb();

    const rows = await db.getAllAsync(`
      SELECT
        class_level,
        COUNT(*) AS student_count
      FROM students
      WHERE status IN ('registered', 'active', 'promoted')
        AND TRIM(class_level) != ''
      GROUP BY class_level
      ORDER BY class_level ASC
    `);

    setClasses(rows);
    setInitialLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClasses();
    }, [loadClasses])
  );

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await loadClasses();
    } finally {
      setRefreshing(false);
    }
  };

  const renderClass = ({ item }) => (
    <Pressable
      style={styles.classCard}
      onPress={() =>
        navigation.navigate('ClassStudents', {
          classLevel: item.class_level,
        })
      }
    >
      <View style={styles.classIcon}>
        <Text style={styles.classIconText}>🎓</Text>
      </View>

      <View style={styles.classInfo}>
        <Text style={styles.className}>
          {item.class_level}
        </Text>

        <Text style={styles.studentCount}>
          {item.student_count}{' '}
          {Number(item.student_count) === 1 ? 'student' : 'students'}
        </Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        <Text style={styles.subtitle}>
          Student distribution by class level
        </Text>
      </View>

      <FlatList
        data={initialLoading ? [] : classes}
        keyExtractor={(item) => item.class_level}
        renderItem={renderClass}
        contentContainerStyle={
          !initialLoading && classes.length === 0
            ? styles.emptyContainer
            : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        ListEmptyComponent={
          initialLoading ? (
            <View>
              <SkeletonClassRow />
              <SkeletonClassRow />
              <SkeletonClassRow />
              <SkeletonClassRow />
              <SkeletonClassRow />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎓</Text>
              <Text style={styles.emptyTitle}>
                No classes yet
              </Text>
              <Text style={styles.emptyText}>
                Classes will appear here when students are registered.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FC',
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#16324f',
  },

  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#667085',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },

  classIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F2EDFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  classIconText: {
    fontSize: 22,
  },

  classInfo: {
    flex: 1,
  },

  className: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1D2939',
  },

  studentCount: {
    marginTop: 4,
    fontSize: 13,
    color: '#667085',
  },

  chevron: {
    fontSize: 28,
    color: '#98A2B3',
  },

  emptyContainer: {
    flexGrow: 1,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },

  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1D2939',
  },

  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    color: '#667085',
    lineHeight: 20,
  },
});

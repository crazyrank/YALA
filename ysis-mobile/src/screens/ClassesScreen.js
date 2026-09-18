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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDb } from '../db';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius, shadow } from '../theme/spacing';

export default function ClassesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [classes, setClasses] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadClasses = useCallback(async () => {
    const db = await getDb();
    const rows = await db.getAllAsync(`
      SELECT class_level, COUNT(*) AS student_count
      FROM students
      WHERE status IN ('registered', 'active', 'promoted')
        AND TRIM(class_level) != ''
      GROUP BY class_level
      ORDER BY class_level ASC
    `);
    setClasses(rows);
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
      style={[
        styles.classCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() =>
        navigation.navigate('ClassStudents', { classLevel: item.class_level })
      }
    >
      <View style={[styles.classIcon, { backgroundColor: colors.goldTint || '#FBF3E1' }]}>
        <Text style={styles.classIconText}>🎓</Text>
      </View>
      <View style={styles.classInfo}>
        <Text style={[styles.className, { color: colors.textPrimary }]}>
          {item.class_level}
        </Text>
        <Text style={[styles.studentCount, { color: colors.textSecondary }]}>
          {item.student_count}{' '}
          {Number(item.student_count) === 1 ? 'student' : 'students'}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 12) + 12 },
        ]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>Classes</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Student distribution by class level
        </Text>
      </View>

      <FlatList
        data={classes}
        keyExtractor={(item) => item.class_level}
        renderItem={renderClass}
        contentContainerStyle={
          classes.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gold}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎓</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No classes yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Classes will appear here when students are registered.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fontFamily.body,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    ...shadow.card,
  },
  classIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  classIconText: { fontSize: 22 },
  classInfo: { flex: 1 },
  className: {
    fontFamily: fontFamily.heading,
    fontSize: 17,
  },
  studentCount: {
    marginTop: 4,
    fontFamily: fontFamily.body,
    fontSize: 13,
  },
  chevron: { fontSize: 28 },
  emptyContainer: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 42, marginBottom: 12 },
  emptyTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
  },
  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: fontFamily.body,
    lineHeight: 20,
  },
});

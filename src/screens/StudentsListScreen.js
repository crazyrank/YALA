import React, { useState, useCallback, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { getDb } from '../db';
import { api } from '../api/client';
import { exportStudentsToCsv } from '../services/csvExport';
import OfflineMarquee from '../components/OfflineMarquee';
import SyncIssueBanner from '../components/SyncIssueBanner';
import DashboardStatCard from '../components/DashboardStatCard';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily, type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function tap(style = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => {});
}

/** Pressable with a smooth spring scale + haptic tap, used everywhere for a premium feel. */
function Squish({ onPress, style, children, scaleTo = 0.95, haptic = true, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };
  const handlePress = () => {
    if (haptic) tap();
    onPress && onPress();
  };

  return (
    <Pressable
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={handlePress}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function StudentCard({ item, navigation, colors }) {
  const initials = getInitials(item.full_name);
  const isActive = item.status === 'active';

  return (
    <Squish
      style={[styles.studentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      scaleTo={0.98}
      onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
    >
      <LinearGradient
        colors={[colors.ink, colors.inkSoft]}
        style={styles.avatar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.avatarText}>{initials}</Text>
      </LinearGradient>

      <View style={styles.studentInfo}>
        <Text style={[styles.studentName, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.full_name}
        </Text>

        <Text style={[styles.admission, { color: colors.textSecondary }]}>
          {item.admission_no || 'No admission number'}
        </Text>

        <Text style={[styles.classText, { color: colors.textMuted }]}>
          {item.class_level || 'Class not assigned'}
          {item.arm ? ` • ${item.arm}` : ''}
        </Text>
      </View>

      <View style={styles.rightArea}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isActive ? colors.successBg : colors.warningBg },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isActive ? colors.success : colors.warning },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isActive ? colors.success : colors.warning },
            ]}
          >
            {(item.status || 'ACTIVE').toUpperCase()}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{ marginTop: 8 }} />
      </View>
    </Squish>
  );
}

export default function StudentsListScreen({ navigation, route }) {
  const { colors } = useTheme();
  const classLevel = route?.params?.classLevel || '';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [pullError, setPullError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const runLocalSearch = useCallback(async (text) => {
    const db = await getDb();
    const term = `%${text}%`;

    let rows;

    if (classLevel && text.trim()) {
      rows = await db.getAllAsync(
        `SELECT id, admission_no, full_name, class_level, arm, status
         FROM students
         WHERE class_level = ?
           AND (full_name LIKE ? OR admission_no LIKE ?)
         ORDER BY full_name ASC
         LIMIT 50`,
        [classLevel, term, term]
      );
    } else if (classLevel) {
      rows = await db.getAllAsync(
        `SELECT id, admission_no, full_name, class_level, arm, status
         FROM students
         WHERE class_level = ?
         ORDER BY full_name ASC
         LIMIT 50`,
        [classLevel]
      );
    } else if (text.trim()) {
      rows = await db.getAllAsync(
        `SELECT id, admission_no, full_name, class_level, arm, status
         FROM students
         WHERE full_name LIKE ?
            OR admission_no LIKE ?
         ORDER BY full_name ASC
         LIMIT 50`,
        [term, term]
      );
    } else {
      rows = await db.getAllAsync(
        `SELECT id, admission_no, full_name, class_level, arm, status
         FROM students
         ORDER BY full_name ASC
         LIMIT 50`
      );
    }

    setResults(rows);
  }, [classLevel]);

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
        setPullError(err.message || 'Could not reach the server.');
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
    tap();

    try {
      const count = await exportStudentsToCsv();
      if (count === 0) {
        Alert.alert('Nothing to export', 'There are no student records stored on this device yet.');
      }
    } catch (err) {
      Alert.alert('Export failed', err.message || 'Could not export student records.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineMarquee />
      <SyncIssueBanner pullError={pullError} onRetryPull={refreshFromServer} />

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.ink} />
        }
        contentContainerStyle={[
          styles.listContent,
          results.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={[type.overline, styles.eyebrow, { color: colors.textMuted }]}>
                  {classLevel ? classLevel.toUpperCase() : 'YALAMATRIX SIS'}
                </Text>
                <Text style={[type.display, styles.title, { color: colors.textPrimary }]}>
                  {classLevel ? `${classLevel} Students` : 'Students'}
                </Text>
                <Text style={[type.bodySmall, { color: colors.textSecondary, marginTop: 5 }]}>
                  {classLevel ? `Students in ${classLevel}.` : 'Manage and access student records.'}
                </Text>
              </View>

              <View style={[styles.countBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.countNumber, { color: colors.textPrimary }]}>{results.length}</Text>
                <Text style={[styles.countLabel, { color: colors.textMuted }]}>SHOWING</Text>
              </View>
            </View>

            {!classLevel && (
              <>
                <View style={styles.statsGrid}>
                  <DashboardStatCard
                    icon="people"
                    value={results.length}
                    title="STUDENTS"
                    subtitle="Registered"
                    color={colors.inkSoft}
                    bg="#EAF0F6"
                    delay={0}
                  />
                  <DashboardStatCard
                    icon="checkmark-circle"
                    value={results.filter((s) => s.status === 'active').length}
                    title="ACTIVE"
                    subtitle="Currently active"
                    color={colors.success}
                    bg={colors.successBg}
                    delay={60}
                  />
                  <DashboardStatCard
                    icon="school"
                    value={new Set(results.map((s) => s.class_level).filter(Boolean)).size}
                    title="CLASSES"
                    subtitle="Represented"
                    color={colors.goldDark}
                    bg={colors.goldTint}
                    delay={120}
                  />
                  <DashboardStatCard
                    icon="sparkles"
                    value={results.length}
                    title="RECENT"
                    subtitle="Student records"
                    color="#5B3A8E"
                    bg="#F1EAFB"
                    delay={180}
                  />
                </View>

                <View style={styles.quickSection}>
                  <Text style={[type.h3, styles.quickTitle, { color: colors.textPrimary }]}>
                    Quick Actions
                    Quick Actions
                  </Text>

                  <View style={styles.quickGrid}>
                    <Squish
                      style={[styles.quickBtn, { backgroundColor: colors.ink }]}
                      onPress={() => navigation.navigate('RegisterStudent')}
                    >
                      <Ionicons name="person-add" size={20} color={colors.gold} />
                      <Text style={[styles.quickBtnText, { color: '#FFFFFF' }]}>Register Student</Text>
                    </Squish>

                    <Squish
                      style={[styles.quickBtn, { backgroundColor: '#EAF0F6' }]}
                      onPress={() => setQuery('')}
                    >
                      <Ionicons name="search" size={20} color={colors.inkSoft} />
                      <Text style={[styles.quickBtnText, { color: colors.inkSoft }]}>Find Student</Text>
                    </Squish>

                    <Squish
                      style={[styles.quickBtn, { backgroundColor: colors.gold }]}
                      onPress={() => navigation.navigate('Classes')}
                    >
                      <Ionicons name="school" size={20} color={colors.ink} />
                      <Text style={[styles.quickBtnText, { color: colors.ink }]}>View Classes</Text>
                    </Squish>

                    <Squish
                      style={[styles.quickBtn, { backgroundColor: colors.goldTint }]}
                      onPress={handleExport}
                      disabled={exporting}
                    >
                      {exporting ? (
                        <ActivityIndicator size="small" color={colors.goldDark} />
                      ) : (
                        <Ionicons name="download" size={20} color={colors.goldDark} />
                      )}
                      <Text style={[styles.quickBtnText, { color: colors.goldDark }]}>Export Records</Text>
                    </Squish>
                  </View>
                </View>

                <View style={[styles.systemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.systemIcon, { backgroundColor: '#EAF0F6' }]}>
                    <Ionicons name="sync" size={18} color={colors.inkSoft} />
                  </View>
                  <View style={styles.systemInfo}>
                    <Text style={[styles.systemTitle, { color: colors.textPrimary }]}>System Status</Text>
                    <Text style={[styles.systemSub, { color: colors.textSecondary }]}>
                      Your student records are stored safely on this device.
                    </Text>
                  </View>
                  <View style={[styles.systemBadge, { backgroundColor: colors.successBg }]}>
                    <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.systemBadgeText, { color: colors.success }]}>READY</Text>
                  </View>
                </View>
              </>
            )}

            <View style={styles.searchArea}>
              <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={19} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textPrimary, fontFamily: fontFamily.bodyMedium }]}
                  placeholder="Search students or admission number"
                  placeholderTextColor={colors.textMuted}
                  value={query}
                  onChangeText={handleChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => handleChange('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={19} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              <Squish
                style={[styles.registerButton, { backgroundColor: colors.ink }]}
                onPress={() => navigation.navigate('RegisterStudent')}
              >
                <Ionicons name="add" size={19} color={colors.gold} />
                <Text style={styles.registerText}>Register</Text>
              </Squish>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {query ? 'Search results' : 'Student records'}
              </Text>

              <View style={styles.sectionRight}>
                <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                  {results.length} record{results.length === 1 ? '' : 's'}
                </Text>

                <Squish
                  style={[styles.exportButton, { backgroundColor: colors.goldTint }]}
                  onPress={handleExport}
                  disabled={exporting}
                >
                  {exporting ? (
                    <ActivityIndicator size="small" color={colors.goldDark} />
                  ) : (
                    <Text style={[styles.exportButtonText, { color: colors.goldDark }]}>Export CSV</Text>
                  )}
                </Squish>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <StudentCard item={item} navigation={navigation} colors={colors} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: '#EAF0F6' }]}>
              <Ionicons name={query ? 'search' : 'people'} size={28} color={colors.inkSoft} />
            </View>

            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {query ? 'No student found' : 'No students yet'}
            </Text>

            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {query
                ? 'No matching student was found in the local records. You can search using a name or admission number.'
                : 'Student records assigned to your account will appear here.'}
            </Text>

            {query.length > 0 ? (
              <Squish
                style={[styles.fallbackButton, { backgroundColor: colors.goldTint }]}
                onPress={() => navigation.navigate('RegisterStudent', { prefillName: query })}
              >
                <Text style={[styles.fallbackButtonText, { color: colors.goldDark }]}>
                  Enter admission number manually
                </Text>
              </Squish>
            ) : (
              <Squish
                style={[styles.emptyRegisterButton, { backgroundColor: colors.ink }]}
                onPress={() => navigation.navigate('RegisterStudent')}
              >
                <Text style={styles.emptyRegisterText}>+ Register first student</Text>
              </Squish>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 30 },
  emptyListContent: { flexGrow: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 22,
    paddingBottom: 20,
  },

  eyebrow: { marginBottom: 6 },
  title: { marginTop: 2 },

  countBox: {
    minWidth: 68,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  countNumber: { fontFamily: fontFamily.display, fontSize: 21 },
  countLabel: { fontFamily: fontFamily.bodyBold, fontSize: 6.5, letterSpacing: 1, marginTop: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },

  quickSection: { marginBottom: 16 },
  quickTitle: { marginBottom: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickBtn: {
    width: '48.5%',
    minHeight: 68,
    borderRadius: radius.lg,
    padding: 13,
    marginBottom: 10,
    ...shadow.raised,
  },
  quickBtnText: { fontFamily: fontFamily.bodyBold, fontSize: 11, marginTop: 8 },

  systemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: 13,
    marginBottom: 18,
    borderWidth: 1,
    ...shadow.raised,
  },
  systemIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  systemInfo: { flex: 1 },
  systemTitle: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  systemSub: { fontFamily: fontFamily.body, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  systemBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  systemBadgeText: { fontFamily: fontFamily.bodyBold, fontSize: 8, letterSpacing: 0.3 },

  searchArea: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  searchBox: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, height: 50, fontSize: 13, paddingVertical: 0 },

  registerButton: {
    height: 52,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
  },
  registerText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bodyBold,
    fontSize: 12.5,
    marginLeft: 5,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: 15 },
  sectionHint: { fontFamily: fontFamily.body, fontSize: 10.5 },
  sectionRight: { flexDirection: 'row', alignItems: 'center' },
  exportButton: { marginLeft: 10, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.sm },
  exportButtonText: { fontFamily: fontFamily.bodyBold, fontSize: 10, letterSpacing: 0.3 },

  studentCard: {
    minHeight: 84,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.raised,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    letterSpacing: 0.4,
  },

  studentInfo: { flex: 1, minWidth: 0 },
  studentName: { fontFamily: fontFamily.heading, fontSize: 14.5 },
  admission: { fontFamily: fontFamily.body, fontSize: 11, marginTop: 3 },
  classText: { fontFamily: fontFamily.bodySemibold, fontSize: 10, marginTop: 5 },

  rightArea: { alignItems: 'flex-end', marginLeft: 8 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 4 },
  statusText: { fontFamily: fontFamily.bodyBold, fontSize: 7, letterSpacing: 0.5 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: 18, textAlign: 'center' },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 310,
  },

  fallbackButton: { borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, marginTop: 18 },
  fallbackButtonText: { fontFamily: fontFamily.bodyBold, fontSize: 11.5 },

  emptyRegisterButton: {
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginTop: 18,
    ...shadow.button,
  },
  emptyRegisterText: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 12 },
});

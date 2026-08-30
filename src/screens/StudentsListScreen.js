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
  Modal,
  Image,
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
import DashboardStudentSyncCards from '../components/DashboardStudentSyncCards';
import Skeleton, {
  SkeletonDashboard,
  SkeletonStatCard,
  SkeletonStudentRow,
} from '../components/Skeleton';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily, type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';
import { gradients } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `\( {parts[0][0]} \){parts[parts.length - 1][0]}`.toUpperCase();
}

function tap(style = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => {});
}

// How many student records show on the dashboard before "See more" is
// needed. The rest aren't lost or hidden anywhere else -- tapping "See
// more" expands this same list in place; "See less" collapses it back.
const DASHBOARD_PREVIEW_COUNT = 3;

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
  const flatStyle = StyleSheet.flatten(style) || {};
  return (
    <Pressable
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={handlePress}
      disabled={disabled}
      style={{ width: flatStyle.width }}
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
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginTop: 8 }} />
      </View>
    </Squish>
  );
}

export default function StudentsListScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const classLevel = route?.params?.classLevel || '';

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [pullError, setPullError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

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
         ORDER BY full_name ASC LIMIT 50`,
        [classLevel, term, term]
      );
    } else if (classLevel) {
      rows = await db.getAllAsync(
        `SELECT id, admission_no, full_name, class_level, arm, status
         FROM students WHERE class_level = ?
         ORDER BY full_name ASC LIMIT 50`,
        [classLevel]
      );
    } else if (text.trim()) {
      rows = await db.getAllAsync(
        `SELECT id, admission_no, full_name, class_level, arm, status
         FROM students
         WHERE full_name LIKE ? OR admission_no LIKE ?
         ORDER BY full_name ASC LIMIT 50`,
        [term, term]
      );
    } else {
      rows = await db.getAllAsync(
        `SELECT id, admission_no, full_name, class_level, arm, status
         FROM students ORDER BY full_name ASC LIMIT 50`
      );
    }
    setResults(rows);
    setInitialLoading(false);
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
            s.id, s.admission_no, s.full_name, s.division || 'secondary',
            s.class_level, s.arm, s.status, s.sync_version,
            new Date().toISOString(), new Date().toISOString(),
          ]
        );
      }
      await runLocalSearch(query);
      setPullError(null);
    } catch (err) {
      setInitialLoading(false);
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

  const displayedResults = (query || showAll) ? results : results.slice(0, DASHBOARD_PREVIEW_COUNT);
  const enrolledCount = results.filter(
  (s) => ['registered', 'active', 'promoted'].includes(s.status)
).length;
  const classCount = new Set(results.map((s) => s.class_level).filter(Boolean)).size;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineMarquee />
      <SyncIssueBanner pullError={pullError} onRetryPull={refreshFromServer} />

      <LinearGradient
        colors={gradients.navy}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: Math.max(insets.top, 12) + 12 }]}
      >
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.heroEyebrow}>
              {classLevel ? classLevel.toUpperCase() : 'YALAMATRIX SIS'}
            </Text>
            <Text style={styles.heroTitle}>
              {classLevel ? `${classLevel} Students` : 'Students'}
            </Text>
            <Text style={styles.heroSub}>
              {classLevel
                ? `Records for ${classLevel}`
                : 'Manage and access student records'}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setMenuOpen(true);
            }}
            style={styles.profileChip}
            hitSlop={8}
          >
            {user?.photo_url || user?.avatar_url ? (
              <Image
                source={{ uri: user.photo_url || user.avatar_url }}
                style={styles.profileAvatarImg}
              />
            ) : (
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {getInitials(user?.full_name || user?.email || 'U')}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-down" size={14} color="#C9A24B" style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        <View style={styles.heroMeta}>
          <View style={styles.heroMetaPill}>
            {initialLoading ? (
              <Skeleton width={28} height={18} borderRadius={6} style={{ marginBottom: 2 }} />
            ) : (
              <Text style={styles.heroMetaNum}>{results.length}</Text>
            )}
            <Text style={styles.heroMetaLabel}>SHOWING</Text>
          </View>
        </View>
      </LinearGradient>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              {user?.photo_url || user?.avatar_url ? (
                <Image
                  source={{ uri: user.photo_url || user.avatar_url }}
                  style={styles.menuAvatarImg}
                />
              ) : (
                <View style={styles.menuAvatar}>
                  <Text style={styles.menuAvatarText}>
                    {getInitials(user?.full_name || user?.email || 'U')}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.menuName} numberOfLines={1}>
                  {user?.full_name || 'Staff'}
                </Text>
                <Text style={styles.menuRole}>
                  {(user?.role || 'staff').replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.menuDivider} />
            {(user?.role === 'principal' || user?.role === 'director') && (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate('MoreTab', { screen: 'ManageStaff' });
                }}
              >
                <Ionicons name="people-outline" size={18} color="#0A1930" />
                <Text style={styles.menuItemText}>Manage Staff</Text>
              </Pressable>
            )}
            {(user?.role === 'principal' || user?.role === 'director') && (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate('ConflictsTab');
                }}
              >
                <Ionicons name="warning-outline" size={18} color="#0A1930" />
                <Text style={styles.menuItemText}>Conflicts</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate('MoreTab');
              }}
            >
              <Ionicons name="grid-outline" size={18} color="#0A1930" />
              <Text style={styles.menuItemText}>More</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                Alert.alert('Sign out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: () => logout(),
                  },
                ]);
              }}
            >
              <Ionicons name="log-out-outline" size={18} color="#C0392B" />
              <Text style={[styles.menuItemText, { color: '#C0392B' }]}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <FlatList
        style={{ flex: 1 }}
        data={initialLoading ? [] : displayedResults}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.ink} />
        }
        contentContainerStyle={[
          styles.listContent,
          !initialLoading && results.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
            <View style={styles.bodyPad}>
              {!classLevel && (
                <>
                  {initialLoading ? (
                    <View style={styles.statsGrid}>
                      <SkeletonStatCard />
                      <SkeletonStatCard />
                      <SkeletonStatCard />
                      <SkeletonStatCard />
                    </View>
                  ) : (
                    <View style={styles.statsGrid}>
                      <DashboardStatCard icon="people" value={results.length} title="Students" subtitle="Registered" color={colors.inkSoft} bg={colors.surface} delay={0} />
                      <DashboardStatCard icon="checkmark-circle" value={enrolledCount} title="Enrolled" subtitle="Currently enrolled" color={colors.success} bg={colors.surface} delay={50} />
                      <DashboardStatCard icon="school" value={classCount} title="Classes" subtitle="Represented" color={colors.goldDark} bg={colors.surface} delay={100} />
                      <DashboardStatCard icon="layers" value={results.length} title="Records" subtitle="On this device" color="#5B3A8E" bg={colors.surface} delay={150} />
                      <DashboardStudentSyncCards />
                    </View>
                  )}
                  <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Quick Actions</Text>
                  <View style={styles.actionRow}>
                    <Squish style={[styles.primaryAction, { backgroundColor: colors.ink }]} onPress={() => navigation.navigate('RegisterStudent')}>
                      <Ionicons name="person-add" size={18} color={colors.gold} />
                      <Text style={styles.primaryActionText}>Register Student</Text>
                    </Squish>
                  </View>
                  <View style={styles.secondaryRow}>
                    <Squish style={[styles.secondaryAction, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigation.navigate('ClassesTab')}>
                      <Ionicons name="school-outline" size={16} color={colors.inkSoft} />
                      <Text style={[styles.secondaryActionText, { color: colors.textPrimary }]}>Classes</Text>
                    </Squish>
                    <Squish style={[styles.secondaryAction, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleExport} disabled={exporting}>
                      {exporting ? (
                        <ActivityIndicator size="small" color={colors.goldDark} />
                      ) : (
                        <Ionicons name="download-outline" size={16} color={colors.goldDark} />
                      )}
                      <Text style={[styles.secondaryActionText, { color: colors.textPrimary }]}>Export</Text>
                    </Squish>
                  </View>
                </>
              )}

              <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  value={query}
                  onChangeText={handleChange}
                  placeholder="Search name or admission no."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {query.length > 0 && (
                  <Pressable onPress={() => handleChange('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {query ? 'Search results' : 'Student records'}
                </Text>
                <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                  {results.length} record{results.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
        }
        renderItem={({ item }) => (
          <View style={styles.listPad}>
            <StudentCard item={item} navigation={navigation} colors={colors} />
          </View>
        )}
        ListFooterComponent={
          !initialLoading && !query && results.length > DASHBOARD_PREVIEW_COUNT ? (
            <View style={styles.listPad}>
              <Squish
                style={[styles.seeMoreBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setShowAll((prev) => !prev)}
              >
                <Text style={[styles.seeMoreText, { color: colors.textPrimary }]}>
                  {showAll ? 'See less' : `See more (${results.length - DASHBOARD_PREVIEW_COUNT})`}
                </Text>
                <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textPrimary} />
              </Squish>
            </View>
          ) : null
        }
        ListEmptyComponent={
          initialLoading ? (
            <View style={styles.listPad}>
              <SkeletonStudentRow />
              <SkeletonStudentRow />
              <SkeletonStudentRow />
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={query ? 'search' : 'people'} size={28} color={colors.inkSoft} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {query ? 'No student found' : 'No students yet'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {query
                  ? 'No matching student was found in the local records. Try a name or admission number.'
                  : 'Student records assigned to your account will appear here.'}
              </Text>
              {query.length > 0 ? (
                <Squish
                  style={[styles.fallbackButton, { backgroundColor: colors.goldTint }]}
                  onPress={() => navigation.navigate('RegisterStudent', { prefillName: query })}
                >
                  <Text style={[styles.fallbackButtonText, { color: colors.goldDark }]}>Register with this name</Text>
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
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 36 },
  emptyListContent: { flexGrow: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(201,162,75,0.35)',
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C9A24B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  profileAvatarText: {
    color: '#0A1930',
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,25,48,0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 72,
    paddingRight: 16,
  },
  menuCard: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E4E8EF',
    ...shadow.card,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16324F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuAvatarImg: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  menuAvatarText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
  },
  menuName: { fontFamily: fontFamily.heading, fontSize: 15, color: '#0A1930' },
  menuRole: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: '#C9A24B',
    marginTop: 2,
  },
  menuDivider: { height: 1, backgroundColor: '#E4E8EF', marginVertical: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuItemText: {
    marginLeft: 12,
    fontFamily: fontFamily.bodySemibold,
    fontSize: 14,
    color: '#0A1930',
  },
  heroEyebrow: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#C9A24B',
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
    color: '#FFFFFF',
  },
  heroSub: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 6,
  },
  heroMeta: { flexDirection: 'row', marginTop: 18 },
  heroMetaPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaNum: {
    fontFamily: fontFamily.display,
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 8,
  },
  heroMetaLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.7)',
  },
  bodyPad: { paddingHorizontal: 18, paddingTop: 18 },
  listPad: { paddingHorizontal: 18 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: fontFamily.heading,
    fontSize: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  actionRow: { marginBottom: 10 },
  primaryAction: {
    height: 52,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
  },
  primaryActionText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
    marginLeft: 10,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  secondaryAction: {
    width: '48%',
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  secondaryActionText: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 13,
    marginLeft: 8,
  },
  searchBox: {
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontFamily: fontFamily.body,
    fontSize: 15,
    paddingVertical: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: 16 },
  sectionHint: { fontFamily: fontFamily.body, fontSize: 12 },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  seeMoreText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    marginRight: 6,
  },
  studentCard: {
    minHeight: 86,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
  studentName: { fontFamily: fontFamily.heading, fontSize: 15 },
  admission: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 3 },
  classText: { fontFamily: fontFamily.bodySemibold, fontSize: 11, marginTop: 5 },
  rightArea: { alignItems: 'flex-end', marginLeft: 8 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontFamily: fontFamily.bodyBold, fontSize: 9, letterSpacing: 0.4 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: 18, textAlign: 'center' },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 310,
  },
  fallbackButton: {
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 18,
  },
  fallbackButtonText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  emptyRegisterButton: {
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 18,
    ...shadow.button,
  },
  emptyRegisterText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
  },
});

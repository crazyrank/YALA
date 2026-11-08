import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { fetchAndCacheAllStudents } from '../services/studentSync';
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
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function tap(style = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => {});
}

// How many student records show on the dashboard before "See more" is
// needed. The rest aren't lost or hidden anywhere else -- tapping "See
// more" expands this same list in place; "See less" collapses it back.
const DASHBOARD_PREVIEW_COUNT = 3;
const PAGE_SIZE = 5;

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
      <Animated.View style={[style, flatStyle.width ? { width: '100%' } : null, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Quick actions. Each key is one card on the dashboard.
const QUICK_ACTIONS = {
  register: { label: 'Register Student', icon: 'person-add-outline', iconColor: 'textPrimary', border: 'border' },
  export: { label: 'Export', icon: 'download-outline', iconColor: 'goldDark', border: 'border' },
  results: { label: 'Check Student Results', icon: 'document-text-outline', iconColor: 'pinkDark', border: 'pink' },
  website: { label: 'School Website', icon: 'globe-outline', iconColor: 'pinkDark', border: 'pink' },
  import: { label: 'Import', icon: 'cloud-upload-outline', iconColor: 'textPrimary', border: 'border' },
  promote: { label: 'Promote class', icon: 'arrow-up-circle-outline', iconColor: 'goldDark', border: 'border' },
  devices: { label: 'Approve devices', icon: 'phone-portrait-outline', iconColor: 'warning', border: 'warning' },
  blackBook: { label: 'Black Book', icon: 'lock-closed-outline', iconColor: 'textPrimary', border: 'border' },
  staffReports: { label: 'Staff Reports', icon: 'ribbon-outline', iconColor: 'goldDark', border: 'border' },
  alumni: { label: 'Alumni', icon: 'school-outline', iconColor: 'textPrimary', border: 'border' },
  permissions: { label: 'Permissions', icon: 'key-outline', iconColor: 'goldDark', border: 'border' },
  manageStaff: { label: 'Manage Staff', icon: 'people-outline', iconColor: 'textPrimary', border: 'border' },
  guests: { label: 'Guest Accounts', icon: 'person-outline', iconColor: 'textPrimary', border: 'border' },
  classTeachers: { label: 'Class Teachers', icon: 'easel-outline', iconColor: 'textPrimary', border: 'border' },
  auditLog: { label: 'Audit Log', icon: 'list-outline', iconColor: 'textPrimary', border: 'border' },
  logBook: { label: 'Log Book', icon: 'book-outline', iconColor: 'goldDark', border: 'border' },
  personalLog: { label: 'My Log', icon: 'journal-outline', iconColor: 'goldDark', border: 'border' },
  classBiodata: { label: 'Class Biodata', icon: 'create-outline', iconColor: 'goldDark', border: 'border' },
  ss3Quiz: { label: 'SS3 quiz', icon: 'trophy-outline', iconColor: 'goldDark', border: 'border' },
};

// Which quick actions each account sees, in display order.
const ADMIN_ACTIONS = [
  'register', 'export', 'results', 'ss3Quiz', 'website', 'import', 'promote', 'devices',
  'blackBook', 'staffReports', 'alumni', 'permissions', 'manageStaff',
  'guests', 'classTeachers', 'auditLog',
];

// Director and Principal: two panels, four icons per row.
// Panel 1 is student work. Panel 2 is school administration.
const ADMIN_PANELS = [
  ['register', 'results', 'ss3Quiz', 'promote', 'import', 'export', 'alumni', 'blackBook', 'website'],
  ['devices', 'manageStaff', 'classTeachers', 'staffReports', 'guests', 'permissions', 'auditLog'],
];

const ROLE_QUICK_ACTIONS = {
  director: ADMIN_ACTIONS,
  principal: [...ADMIN_ACTIONS, 'personalLog'],
  head_teacher: ['register', 'export', 'results', 'ss3Quiz', 'website', 'import', 'logBook'],
  class_teacher: ['register', 'website', 'classBiodata', 'ss3Quiz'],
  guest: ['website'],
};

function QuickAction({ actionKey, navigation, colors, exporting, pendingDevices, onExport }) {
  const action = QUICK_ACTIONS[actionKey];
  if (!action) return null;
  if (actionKey === 'devices' && pendingDevices <= 0) return null;

  const openMore = (screen) => navigation.navigate('MoreTab', { screen });
  const targets = {
    register: () => navigation.navigate('RegisterStudent'),
    export: onExport,
    results: () => openMore('ResultPortal'),
    website: () => openMore('SchoolWebsite'),
    import: () => openMore('ImportStudents'),
    promote: () => navigation.navigate('PromoteClass'),
    devices: () => openMore('DeviceReview'),
    blackBook: () => openMore('BlackBook'),
    staffReports: () => openMore('StaffReports'),
    alumni: () => openMore('Alumni'),
    permissions: () => openMore('PermissionDelegation'),
    manageStaff: () => openMore('ManageStaff'),
    guests: () => openMore('GuestAccounts'),
    classTeachers: () => openMore('ClassTeachers'),
    auditLog: () => openMore('AuditLog'),
    logBook: () => openMore('LogBook'),
    personalLog: () => openMore('PersonalLog'),
    ss3Quiz: () => navigation.navigate('Ss3QuizView'),
    classBiodata: () => navigation.navigate('ClassesTab'),
  };

  const isExport = actionKey === 'export';
  const tint = action.iconColor === 'textPrimary' ? colors.brandDark : colors[action.iconColor];
  return (
    <Squish
      style={styles.actionTile}
      onPress={targets[actionKey]}
      disabled={isExport && exporting}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: tint + '1F' }]}>
        {isExport && exporting ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          <Ionicons name={action.icon} size={24} color={tint} />
        )}
        {actionKey === 'devices' && (
          <View style={[styles.actionBadge, styles.tileBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.actionBadgeText}>{pendingDevices}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={[styles.actionTileLabel, { color: colors.textPrimary }]}>{action.label}</Text>
    </Squish>
  );
}

function StudentCard({ item, navigation, colors, isGuest }) {
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
            {item.approval_status === 'pending' ? 'PENDING' : item.approval_status === 'returned' ? 'RETURNED' : (isGuest && item.status === 'withdrawn' ? 'LEFT' : (item.status || 'ACTIVE')).toUpperCase()}
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
  const isAdmin = user?.role === 'principal' || user?.role === 'director';
  const canRegister = isAdmin || user?.role === 'head_teacher';
  const [pendingDevices, setPendingDevices] = useState(0);

  // Only Principals and Directors ask. The server refuses everyone else anyway.
  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) {
        setPendingDevices(0);
        return undefined;
      }
      let cancelled = false;
      api
        .get('/devices/pending-count')
        .then((res) => { if (!cancelled) setPendingDevices(Number(res?.count) || 0); })
        .catch(() => { if (!cancelled) setPendingDevices(0); });
      return () => { cancelled = true; };
    }, [isAdmin])
  );
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
  const [page, setPage] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, enrolled: 0, exited: 0, classes: 0 });
  const searchSeq = useRef(0);

  const loadStats = useCallback(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status IN ('registered','active','promoted') THEN 1 ELSE 0 END) AS enrolled,
              SUM(CASE WHEN status IN ('transferred','withdrawn','expelled','graduated') THEN 1 ELSE 0 END) AS exited,
              COUNT(DISTINCT class_level) AS classes
       FROM students`
    );
    setStats({
      total: Number(row?.total || 0),
      enrolled: Number(row?.enrolled || 0),
      exited: Number(row?.exited || 0),
      classes: Number(row?.classes || 0),
    });
  }, []);

  // Searches the phone's copy. Shows PAGE_SIZE rows per page. Stale results
  // from an earlier keystroke are dropped, so the list always matches the text.
  const runLocalSearch = useCallback(async (text, pageIndex = 0) => {
    const seq = ++searchSeq.current;
    const db = await getDb();
    const trimmed = String(text || '').trim();
    const hasText = trimmed.length > 0;

    loadStats();

    // Nothing to show until the user searches or a class is open.
    if (!classLevel && !hasText && user?.role !== 'guest') {
      if (seq !== searchSeq.current) return;
      setResults([]);
      setMatchCount(0);
      setPage(0);
      setInitialLoading(false);
      return;
    }

    const conditions = [];
    const params = [];
    // Students who have left are shown on the Leavers screen, not in the class lists.
    if (user?.role !== 'guest') {
      conditions.push("status NOT IN ('graduated','transferred','withdrawn','expelled','deceased','not_admitted')");
    }
    if (classLevel) {
      conditions.push('class_level = ?');
      params.push(classLevel);
    }
    if (hasText) {
      const term = `%${trimmed}%`;
      conditions.push('(full_name LIKE ? OR admission_no LIKE ?)');
      params.push(term, term);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM students ${where}`, params);
    if (seq !== searchSeq.current) return;
    const total = Number(countRow?.n || 0);
    const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
    const safePage = Math.min(Math.max(0, pageIndex), lastPage);

    const rows = await db.getAllAsync(
      `SELECT id, admission_no, full_name, class_level, arm, status, approval_status, registered_by
       FROM students ${where}
       ORDER BY full_name ASC
       LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, safePage * PAGE_SIZE]
    );
    if (seq !== searchSeq.current) return;

    setMatchCount(total);
    setPage(safePage);
    setResults(rows);
    setInitialLoading(false);
  }, [classLevel, loadStats, user?.role]);

  const refreshFromServer = useCallback(async (force = false) => {
    try {
      await fetchAndCacheAllStudents({ force });
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
      let active = true;

      const loadStudents = async () => {
        // 1. Instant paint from local SQLite
        if (active) {
          await runLocalSearch(query);
        }

        // 2. Background revalidation (never blocks the UI)
        try {
          await refreshFromServer(false);
        } catch (_) {
          // already handled inside refreshFromServer
        }
      };

      loadStudents();

      return () => {
        active = false;
      };
    }, [query, refreshFromServer, runLocalSearch])
  );

  const handleChange = (text) => {
    setQuery(text);
    runLocalSearch(text);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshFromServer(true);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    tap();
    try {
      const result = await exportStudentsToCsv();
      if (result.count === 0) {
        Alert.alert('Nothing to export', 'There are no student records stored on this device yet.');
      } else if (result.notImportable > 0) {
        Alert.alert(
          'Export complete',
          `${result.count} students exported. ${result.notImportable} of them are missing a value the import needs ` +
            '(gender, date of birth, session, or arm for SS2 and SS3). They are in the file, but a re-import will skip them ' +
            'until those values are filled in.'
        );
      }
    } catch (err) {
      Alert.alert('Export failed', err.message || 'Could not export student records.');
    } finally {
      setExporting(false);
    }
  };

  const [ss3Allowed, setSs3Allowed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/ss3-quiz-view/access')
      .then((res) => { if (!cancelled) setSs3Allowed(!!res.allowed); })
      .catch(() => { if (!cancelled) setSs3Allowed(false); });
    return () => { cancelled = true; };
  }, [user?.role]);

  const displayedResults = results;
  const roleActions = ROLE_QUICK_ACTIONS[user?.role] || [];
  const rawPanels = isAdmin ? ADMIN_PANELS.map((p) => [...p]) : [[...roleActions]];
  // Any action added to the role list but missing from a panel still shows (last panel).
  if (isAdmin) {
    const placed = rawPanels.flat();
    rawPanels[rawPanels.length - 1].push(...roleActions.filter((k) => !placed.includes(k)));
  }
  const actionPanels = rawPanels
    .map((p) => p.filter((k) => !(k === 'devices' && pendingDevices <= 0) && !(k === 'ss3Quiz' && !ss3Allowed)))
    .filter((p) => p.length > 0);
  const enrolledCount = stats.enrolled;
  const classCount = stats.classes;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineMarquee />
      <SyncIssueBanner
        pullError={pullError}
        onRetryPull={refreshFromServer}
        onPressAttention={() => navigation.navigate('ParkedOperations')}
      />

      <LinearGradient
        colors={gradients.navy}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top }]}
      >
        <View style={styles.heroTopRow}>
          {classLevel ? (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={styles.heroBackBtn}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
          ) : null}

          <View style={{ flex: 1, paddingRight: 8 }}>
            {!classLevel && (
              <Text style={styles.heroEyebrow} numberOfLines={1}>YALAMATRIX SIS</Text>
            )}
            <Text
              style={styles.heroTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {classLevel || 'Students'}
            </Text>
          </View>

          <View style={styles.heroMetaPill}>
            {initialLoading ? (
              <Skeleton width={24} height={14} borderRadius={6} style={{ marginBottom: 2 }} />
            ) : (
              <Text style={styles.heroMetaNum}>{matchCount}</Text>
            )}
            <Text style={styles.heroMetaLabel}>SHOWING</Text>
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
                  {getInitials(user?.fullName || user?.full_name || user?.email || 'U')}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-down" size={12} color="#2FA37A" style={{ marginLeft: 3 }} />
          </Pressable>
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
                    {getInitials(user?.fullName || user?.full_name || user?.email || 'U')}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.menuName} numberOfLines={1}>
                  {user?.fullName || user?.full_name || 'Guest'}
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
                <Ionicons name="people-outline" size={18} color="#0E1A2B" />
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
                <Ionicons name="warning-outline" size={18} color="#0E1A2B" />
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
              <Ionicons name="grid-outline" size={18} color="#0E1A2B" />
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
                      <SkeletonStatCard />
                      <SkeletonStatCard />
                    </View>
                  ) : user?.role === 'guest' ? null : (
                    <View style={styles.statsGrid}>
                      <DashboardStatCard icon="people" value={stats.total} title="Students" subtitle="On this device" color={colors.textPrimary} bg={colors.surface} delay={0} />
                      <DashboardStatCard icon="checkmark-circle" value={stats.enrolled} title="Enrolled" subtitle={`${Math.round((stats.enrolled / Math.max(stats.total, 1)) * 100)}% of students`} color={colors.success} bg={colors.surface} delay={50} />
                      <DashboardStatCard icon="exit-outline" value={stats.exited} title="Exited" subtitle={`${Math.round((stats.exited / Math.max(stats.total, 1)) * 100)}% of students`} color={colors.error} bg={colors.surface} delay={100} />
                      <DashboardStatCard icon="school" value={stats.classes} title="Classes" subtitle="Represented" color={colors.goldDark} bg={colors.surface} delay={150} />
                      
<DashboardStudentSyncCards />
                    </View>
                  )}
                  <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Quick Actions</Text>
                  {actionPanels.map((panel, panelIndex) => (
                    <View
                      key={panelIndex}
                      style={[styles.actionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      {panel.map((key) => (
                        <QuickAction
                          key={key}
                          actionKey={key}
                          navigation={navigation}
                          colors={colors}
                          exporting={exporting}
                          pendingDevices={pendingDevices}
                          onExport={handleExport}
                        />
                      ))}
                    </View>
                  ))}
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
                  {matchCount} record{matchCount === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
        }
        renderItem={({ item }) => (
          <View style={styles.listPad}>
            <StudentCard item={item} navigation={navigation} colors={colors} isGuest={user?.role === 'guest'} />
          </View>
        )}
        ListFooterComponent={
          !initialLoading && matchCount > PAGE_SIZE ? (
            <View style={styles.listPad}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Squish
                  disabled={page === 0}
                  onPress={() => runLocalSearch(query, page - 1)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
                    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
                    opacity: page === 0 ? 0.4 : 1,
                  }}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Previous</Text>
                </Squish>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, matchCount)} of {matchCount}
                </Text>
                <Squish
                  disabled={(page + 1) * PAGE_SIZE >= matchCount}
                  onPress={() => runLocalSearch(query, page + 1)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
                    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
                    opacity: (page + 1) * PAGE_SIZE >= matchCount ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Next</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
                </Squish>
              </View>
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
                <Ionicons name={query ? 'search' : 'people'} size={28} color={colors.textPrimary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {query ? 'No student found' : 'Search for a student'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {query
                  ? 'No matching student was found in the local records. Try a name or admission number.'
                  : 'Student records assigned to your account will appear here.'}
              </Text>
              {canRegister && (query.length > 0 ? (
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
              ))}
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
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center' },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,162,75,0.35)',
  },
  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2FA37A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  profileAvatarText: {
    color: '#0E1A2B',
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
    backgroundColor: '#17263B',
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
  menuName: { fontFamily: fontFamily.heading, fontSize: 15, color: '#0E1A2B' },
  menuRole: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: '#2FA37A',
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
    color: '#0E1A2B',
  },
  heroBackBtn: { marginRight: 6, padding: 2 },
  heroEyebrow: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#2FA37A',
    marginBottom: 1,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaNum: {
    fontFamily: fontFamily.display,
    fontSize: 15,
    color: '#FFFFFF',
    marginRight: 6,
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
  actionPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  actionTile: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  actionIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTileLabel: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 7,
    minHeight: 28,
    textAlign: 'center',
  },
  tileBadge: {
    top: -4,
    right: -6,
    marginLeft: 0,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  secondaryAction: {
    width: '48%',
    height: 60,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  secondaryActionText: {
    fontFamily: fontFamily.heading,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 6,
    textAlign: 'center',
  },
  actionBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
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

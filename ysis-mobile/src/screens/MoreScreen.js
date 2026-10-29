import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius, shadow } from '../theme/spacing';
import { getDb } from '../db';

function MenuRow({ icon, label, subtitle, color, onPress, danger }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: danger ? colors.errorBg : color + '18' },
        ]}
      >
        <Ionicons name={icon} size={20} color={danger ? colors.error : color} />
      </View>
      <View style={styles.rowText}>
        <Text
          style={[
            styles.rowLabel,
            { color: danger ? colors.error : colors.textPrimary },
          ]}
        >
          {label}
        </Text>
        {!!subtitle && (
          <Text style={[styles.rowSub, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function AppearanceToggle({ value, onChange }) {
  const { colors } = useTheme();
  const options = [
    { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { key: 'light', label: 'Light', icon: 'sunny-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];
  return (
    <View
      style={[
        styles.appearanceRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.appearanceOption,
              active && { backgroundColor: colors.ink },
            ]}
          >
            <Ionicons
              name={opt.icon}
              size={16}
              color={active ? colors.gold : colors.textMuted}
            />
            <Text
              style={[
                styles.appearanceOptionText,
                { color: active ? colors.textInverse : colors.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// Keeps only letters, digits, spaces, and . ' / - so the search text is safe to use.
// The text is also passed to the database as a parameter, never joined into the SQL.
function sanitizeSearch(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[^A-Za-z0-9 .'\/\-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^ +/, '')
    .slice(0, 40);
}

function SearchResults({ query, rows, navigation, colors }) {
  if (query.length < 2) {
    return (
      <Text style={[styles.resultHint, { color: colors.textMuted }]}>
        Type at least 2 letters or numbers.
      </Text>
    );
  }
  if (rows.length === 0) {
    return (
      <Text style={[styles.resultHint, { color: colors.textMuted }]}>
        No student matches "{query}".
      </Text>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {rows.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
          style={[styles.resultRow, { borderBottomColor: colors.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.resultName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.full_name}
            </Text>
            <Text style={[styles.resultSub, { color: colors.textMuted }]} numberOfLines={1}>
              {item.admission_no}, {item.class_level}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function MoreScreen({ navigation }) {
  const { user, logout, updateProfilePhoto, removeProfilePhoto } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.role === 'principal' || user?.role === 'director';
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!searchOpen || query.length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const db = await getDb();
        const term = `%${query}%`;
        const rows = await db.getAllAsync(
          `SELECT id, admission_no, full_name, class_level
             FROM students
            WHERE full_name LIKE ? OR admission_no LIKE ?
            ORDER BY full_name ASC
            LIMIT 25`,
          [term, term]
        );
        if (!cancelled) setResults(rows || []);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchOpen]);

  const onQueryChange = (text) => setQuery(sanitizeSearch(text));
  const toggleSearch = () => {
    setSearchOpen((open) => !open);
    setQuery('');
    setResults([]);
  };

  const confirmLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const pickAndSave = async (fromCamera) => {
    try {
      if (fromCamera) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          Alert.alert(
            'Permission needed',
            'Camera access is required to take a profile photo.'
          );
          return;
        }
      } else {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) {
          Alert.alert(
            'Permission needed',
            'Photo library access is required to choose a profile picture.'
          );
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploading(true);
      await updateProfilePhoto(result.assets[0].uri);
      Alert.alert(
        'Profile updated',
        'Your profile picture has been saved on this device.'
      );
    } catch (err) {
      Alert.alert(
        'Could not update photo',
        err.message || 'Something went wrong.'
      );
    } finally {
      setUploading(false);
    }
  };

  const openChangeMenu = () => {
    Alert.alert('Change profile picture', 'Choose a source', [
      { text: 'Take photo', onPress: () => pickAndSave(true) },
      { text: 'Choose from library', onPress: () => pickAndSave(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAvatarPress = () => {
    const hasPhoto = !!(user?.photo_url || user?.avatar_url);
    if (!hasPhoto) {
      openChangeMenu();
      return;
    }
    Alert.alert('Profile picture', undefined, [
      { text: 'View photo', onPress: () => setViewerOpen(true) },
      { text: 'Change photo', onPress: openChangeMenu },
      {
        text: 'Remove photo',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeProfilePhoto();
          } catch (e) {
            Alert.alert('Error', e.message || 'Could not remove photo.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleChangePhoto = () => {
    const hasPhoto = !!(user?.photo_url || user?.avatar_url);
    if (hasPhoto) {
      handleAvatarPress();
    } else {
      openChangeMenu();
    }
  };

  const photoUri = user?.photo_url || user?.avatar_url || null;

  return (
    <>
      <View style={[styles.settingsHeader, { paddingTop: insets.top + 6 }]}>
        <Text style={[styles.settingsTitle, { color: colors.textPrimary }]}>Settings</Text>
        <Pressable
          onPress={toggleSearch}
          hitSlop={12}
          style={styles.searchBtn}
          accessibilityLabel={searchOpen ? 'Close search' : 'Search'}
        >
          <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      {searchOpen && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search students by name or admission no."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={40}
            returnKeyType="search"
          />
        </View>
      )}

      {searchOpen ? (
        <SearchResults query={query} rows={results} navigation={navigation} colors={colors} />
      ) : (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 12 },
        ]}
      >
        <View
          style={[
            styles.profile,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            onPress={handleAvatarPress}
            disabled={uploading}
            style={styles.avatarWrap}
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.avatarImg}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.ink }]}>
                <Text style={styles.avatarText}>
                  {getInitials(user?.full_name || user?.email || 'U')}
                </Text>
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: colors.gold }]}>
              {uploading ? (
                <ActivityIndicator size="small" color="#0E1A2B" />
              ) : (
                <Ionicons name="camera" size={14} color="#0E1A2B" />
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.name, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {user?.full_name || 'Staff'}
            </Text>
            <Text style={[styles.role, { color: colors.goldDark }]}>
              {(user?.role || 'staff').replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text style={[styles.tapHint, { color: colors.textMuted }]}>
              Tap photo to view or change
            </Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.textMuted }]}>APPEARANCE</Text>
        <AppearanceToggle value={preference} onChange={setPreference} />

        <Text style={[styles.section, { color: colors.textMuted, marginTop: 18 }]}>PROFILE</Text>

        <MenuRow
          icon="camera"
          label="Change profile picture"
          subtitle="Upload, view, or remove your photo"
          color={colors.inkSoft}
          onPress={handleChangePhoto}
        />

        <Text style={[styles.section, { color: colors.textMuted }]}>MANAGE</Text>

        {isAdmin && (
          <MenuRow
            icon="people"
            label="Manage Staff"
            subtitle="Create and manage accounts"
            color={colors.inkSoft}
            onPress={() => navigation.navigate('ManageStaff')}
          />
        )}

        {isAdmin && (
          <MenuRow
            icon="phone-portrait"
            label="Trusted Devices"
            subtitle="Approve, review and revoke devices"
            color={colors.inkSoft}
            onPress={() => navigation.navigate('DeviceReview')}
          />
        )}

        <MenuRow
          icon="play-circle-outline"
          label="Replay introduction"
          subtitle="Watch the school declaration again"
          color={colors.goldDark}
          onPress={() => navigation.navigate('Intro', { replay: true })}
        />

        <MenuRow
          icon="notifications"
          label="Notifications"
          subtitle="Alerts for your account"
          color={colors.inkSoft}
          onPress={() => navigation.navigate('Notifications')}
        />

        <MenuRow
          icon="albums"
          label="Staff Directory"
          subtitle="Board, management & class teachers"
          color={colors.goldDark}
          onPress={() => navigation.navigate('StaffDirectory')}
        />

        {isAdmin && (
          <MenuRow
            icon="warning"
            label="Conflicts"
            subtitle="Resolve sync conflicts"
            color={colors.warning}
            onPress={() => navigation.navigate('ConflictsTab')}
          />
        )}

        {isAdmin && (
          <MenuRow
            icon="git-merge"
            label="Duplicate Registrations"
            subtitle="Merge queue"
            color="#5B3A8E"
            onPress={() => navigation.navigate('MergeQueue')}
          />
        )}

        {isAdmin && (
          <MenuRow
            icon="cloud-upload"
            label="Import Students"
            subtitle="Upload a CSV from this phone"
            color={colors.inkSoft}
            onPress={() => navigation.navigate('ImportStudents')}
          />
        )}

        <MenuRow
          icon="person-add"
          label="Register Student"
          subtitle="Add a new student record"
          color={colors.inkSoft}
          onPress={() => navigation.navigate('RegisterTab')}
        />

        <Text
          style={[styles.section, { color: colors.textMuted, marginTop: 18 }]}
        >
          ACCOUNT
        </Text>

        <MenuRow
          icon="log-out-outline"
          label="Sign out"
          subtitle="End this session"
          color={colors.error}
          danger
          onPress={confirmLogout}
        />
      </ScrollView>
      )}

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable
            style={styles.viewerClose}
            onPress={() => setViewerOpen(false)}
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.viewerActions}>
            <Pressable
              style={styles.viewerBtn}
              onPress={() => {
                setViewerOpen(false);
                openChangeMenu();
              }}
            >
              <Text style={styles.viewerBtnText}>Change</Text>
            </Pressable>
            <Pressable
              style={[styles.viewerBtn, styles.viewerBtnGhost]}
              onPress={() => setViewerOpen(false)}
            >
              <Text style={styles.viewerBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  settingsTitle: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  searchBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 15,
    paddingVertical: 0,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultName: { fontFamily: fontFamily.heading, fontSize: 15 },
  resultSub: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 2 },
  resultHint: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 22,
    ...shadow.raised,
  },
  avatarWrap: {
    marginRight: 14,
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E4E8EF',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.display,
    fontSize: 20,
  },
  name: {
    fontFamily: fontFamily.heading,
    fontSize: 17,
  },
  role: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  tapHint: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...shadow.raised,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 15,
  },
  rowSub: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    marginTop: 2,
  },
  appearanceRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 4,
    marginBottom: 10,
    ...shadow.raised,
  },
  appearanceOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  appearanceOptionText: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 13,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,25,48,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').width - 40,
    borderRadius: 16,
    backgroundColor: '#17263B',
  },
  viewerActions: {
    flexDirection: 'row',
    marginTop: 28,
  },
  viewerBtn: {
    backgroundColor: '#2FA37A',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  viewerBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerBtnText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
  },
});

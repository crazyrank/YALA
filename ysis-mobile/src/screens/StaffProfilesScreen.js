import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius } from '../theme/spacing';
import { api } from '../api/client';

const ROLE_LABELS = {
  principal: 'Principal',
  head_teacher: 'Head Teacher',
  class_teacher: 'Class Teacher',
};
const DIVISION_LABELS = { primary: 'Primary', secondary: 'Secondary' };

function assignmentText(a) {
  const division = DIVISION_LABELS[a.division] || a.division;
  if (!a.classLevel) return `${division}, whole division`;
  return `${division}, ${a.classLevel}${a.arm ? ` ${a.arm}` : ''}`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StaffProfilesScreen() {
  const { colors } = useTheme();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/staff-profiles');
      setStaff(res.staff || []);
    } catch (e) {
      setError(e.message || 'Could not load staff.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openProfile = async (row) => {
    setOpen(true);
    setProfile(null);
    setProfileError('');
    setProfileLoading(true);
    try {
      const res = await api.get(`/staff-profiles/${row.id}`);
      setProfile(res.profile);
    } catch (e) {
      setProfileError(e.message || 'Could not open this profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setOpen(false);
    setProfile(null);
    setProfileError('');
  };

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.note, { color: colors.textMuted }]}>
          Tap a person to see their contact details and class or division. Profiles are read only.
        </Text>

        {loading && <ActivityIndicator style={{ marginTop: 24 }} color={colors.gold} />}

        {!!error && !loading && (
          <Text style={[styles.note, { color: colors.error }]}>{error}</Text>
        )}

        {!loading && !error && staff.length === 0 && (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            No staff members are in your scope yet.
          </Text>
        )}

        {staff.map((s) => {
          const suspended = s.status === 'suspended';
          const place = s.classLevel
            ? `${DIVISION_LABELS[s.division] || s.division}, ${s.classLevel}${s.arm ? ` ${s.arm}` : ''}`
            : s.division
            ? DIVISION_LABELS[s.division] || s.division
            : '';
          return (
            <Pressable
              key={s.id}
              onPress={() => openProfile(s)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {s.fullName}
                </Text>
                <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                  {ROLE_LABELS[s.role] || s.role}
                  {place ? `, ${place}` : ''}
                </Text>
              </View>
              {suspended && (
                <Text style={[styles.badge, { color: colors.error, borderColor: colors.error }]}>
                  Suspended
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={closeProfile}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {profileLoading && <ActivityIndicator style={{ marginVertical: 30 }} color={colors.gold} />}

            {!!profileError && (
              <Text style={[styles.note, { color: colors.error }]}>{profileError}</Text>
            )}

            {!!profile && (
              <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
                <Text style={[styles.sheetName, { color: colors.textPrimary }]}>{profile.fullName}</Text>
                <Text style={[styles.sub, { color: colors.textMuted }]}>
                  {ROLE_LABELS[profile.role] || profile.role}
                  {profile.status === 'suspended' ? ' (suspended)' : ''}
                </Text>

                <Text style={[styles.label, { color: colors.textMuted }]}>EMAIL</Text>
                <Text style={[styles.value, { color: colors.textPrimary }]}>
                  {profile.email || 'Not recorded'}
                </Text>

                <Text style={[styles.label, { color: colors.textMuted }]}>PHONE</Text>
                <Text style={[styles.value, { color: colors.textPrimary }]}>
                  {profile.phone || 'Not recorded'}
                </Text>

                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {profile.role === 'head_teacher' ? 'SCOPE' : 'CLASS OR DIVISION'}
                </Text>
                {profile.assignments.length === 0 && (
                  <Text style={[styles.value, { color: colors.textMuted }]}>Not assigned yet</Text>
                )}
                {profile.assignments.map((a, i) => (
                  <Text key={i} style={[styles.value, { color: colors.textPrimary }]}>
                    {assignmentText(a)}
                  </Text>
                ))}

                <Text style={[styles.label, { color: colors.textMuted }]}>JOINED</Text>
                <Text style={[styles.value, { color: colors.textPrimary }]}>
                  {formatDate(profile.createdAt) || 'Not recorded'}
                </Text>
              </ScrollView>
            )}

            <Pressable onPress={closeProfile} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  note: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 6, marginBottom: 12, lineHeight: 19 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  name: { fontFamily: fontFamily.heading, fontSize: 15 },
  sub: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 2 },
  badge: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,25,48,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  sheetName: { fontFamily: fontFamily.display, fontSize: 20 },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  value: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22 },
  closeBtn: { alignItems: 'center', paddingVertical: 14 },
  closeText: { fontFamily: fontFamily.bodySemibold, fontSize: 14 },
});

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius, shadow } from '../theme/spacing';

export default function ManageStaffScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const isDirector = user?.role === 'director';
  const staffLabel = isDirector ? 'Principals' : 'Head Teachers';
  const createLabel = isDirector ? 'Create Principal' : 'Create Head Teacher';

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStaff = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await api.get('/users');
      setStaff(result.users || []);
    } catch (err) {
      if (!err.isNetworkError) {
        Alert.alert('Could not load staff', err.message || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStaff();
    }, [loadStaff])
  );

  const toggleStatus = (member) => {
    const nextStatus = member.status === 'active' ? 'suspended' : 'active';
    const verb = nextStatus === 'suspended' ? 'Disable' : 'Enable';
    const name = member.fullName || member.full_name || 'This account';

    Alert.alert(
      `${verb} account?`,
      `${name} will ${
        nextStatus === 'suspended'
          ? 'no longer be able to sign in.'
          : 'be able to sign in again.'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: nextStatus === 'suspended' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const result = await api.patch(`/users/${member.id}/status`, {
                status: nextStatus,
              });
              setStaff((prev) =>
                prev.map((s) => (s.id === member.id ? result.user : s))
              );
            } catch (err) {
              Alert.alert(
                'Could not update account',
                err.message || 'Something went wrong.'
              );
            }
          },
        },
      ]
    );
  };

  const getInitials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const renderItem = ({ item }) => {
    const name = item.fullName || item.full_name || 'Staff';
    const email = item.email || '';
    const status = item.status || 'active';
    const suspended = status === 'suspended';

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surfaceAlt || '#1B2438', borderColor: colors.border },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.inkSoft || '#16324F' }]}>
          <Text style={styles.avatarText}>{getInitials(name)}</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
            {email}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: suspended ? colors.error : colors.success },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: suspended ? colors.error : colors.success },
              ]}
            >
              {suspended ? 'Suspended' : 'Active'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => toggleStatus(item)}
          style={[
            styles.actionBtn,
            {
              backgroundColor: suspended ? colors.gold : 'rgba(255,255,255,0.08)',
            },
          ]}
        >
          <Text
            style={[
              styles.actionText,
              { color: suspended ? '#0A1930' : colors.textPrimary },
            ]}
          >
            {suspended ? 'Enable' : 'Disable'}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background || '#0B1220' }]}>
      <View style={styles.headerBlock}>
        <Text style={[styles.eyebrow, { color: colors.gold }]}>STAFF</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{staffLabel}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Accounts you created and manage
        </Text>
      </View>

      <Pressable
        style={[styles.createBtn, { backgroundColor: colors.gold }]}
        onPress={() => navigation.navigate('CreateAccount')}
      >
        <Ionicons name="person-add" size={18} color="#0A1930" />
        <Text style={styles.createBtnText}>{createLabel}</Text>
      </Pressable>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            staff.length === 0 && styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadStaff(true)}
              tintColor={colors.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No {staffLabel.toLowerCase()} yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Tap “{createLabel}” to add the first account.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  eyebrow: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    marginTop: 4,
  },
  createBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    height: 52,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.goldGlow,
  },
  createBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    color: '#0A1930',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  emptyList: { flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    ...shadow.card,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.heading,
    fontSize: 15,
  },
  cardBody: { flex: 1, paddingRight: 8 },
  name: {
    fontFamily: fontFamily.heading,
    fontSize: 15,
  },
  email: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 11,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  actionText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 17,
    marginTop: 12,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
});
